package com.lemondelila.client.framework.network.realtime;

import java.time.Duration;
import java.util.Objects;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;

/**
 * Base utilitaire pour les services temps réel :
 * - ouverture/fermeture de la connexion en fonction du nombre de "clients" actifs
 * - reconnexion avec backoff exponentiel + jitter
 * - file d'attente d'actions à exécuter une fois connecté
 */
public abstract class AbstractRealtimeService<K, C extends AutoCloseable> implements AutoCloseable {

    public interface ConnectionCallbacks {
        void onConnected();

        /**
         * @param retryable false si la reconnexion doit s'arrêter (ex: auth refusée côté serveur)
         */
        void onDisconnected(boolean retryable);

        void onError(Throwable error);
    }

    private static final Duration INITIAL_RETRY_DELAY = Duration.ofSeconds(2);
    private static final Duration MAX_RETRY_DELAY = Duration.ofSeconds(30);
    private static final int MAX_BACKOFF_POWER = 5;
    private static final int MAX_PENDING_ACTIONS = 200;

    private final Object lock = new Object();
    private final Queue<Consumer<C>> pending = new ConcurrentLinkedQueue<>();
    private final ScheduledExecutorService reconnectExecutor;

    private volatile int activeClients;
    private volatile boolean closed;
    private volatile boolean connected;
    private volatile boolean reconnectDisabled;
    private volatile K desiredKey;
    private volatile K connectionKey;
    private volatile C connection;
    private int retryAttempts;
    private ScheduledFuture<?> scheduledReconnect;

    protected AbstractRealtimeService(String threadPrefix) {
        String prefix = (threadPrefix == null || threadPrefix.isBlank()) ? "realtime" : threadPrefix;
        this.reconnectExecutor = Executors.newSingleThreadScheduledExecutor(new NamedDaemonThreadFactory(prefix + "-reconnect-"));
    }

    public AutoCloseable acquire(K key) {
        synchronized (lock) {
            activeClients++;
            desiredKey = key;
            reconnectDisabled = false;
            ensureConnectionLocked();
        }
        return this::release;
    }

    protected final void ensureConnectedTo(K key) {
        synchronized (lock) {
            desiredKey = key;
            reconnectDisabled = false;
            ensureConnectionLocked();
        }
    }

    private void release() {
        synchronized (lock) {
            if (activeClients <= 0) {
                return;
            }
            activeClients--;
            if (activeClients == 0) {
                desiredKey = null;
                cancelReconnectLocked();
                closeConnectionLocked();
                retryAttempts = 0;
                connected = false;
            }
        }
    }

    protected final void enqueueOrRun(Consumer<C> action) {
        Objects.requireNonNull(action, "action");
        C conn = connection;
        if (connected && conn != null) {
            action.accept(conn);
            return;
        }
        if (pending.size() >= MAX_PENDING_ACTIONS) {
            pending.poll();
        }
        pending.offer(action);
        synchronized (lock) {
            if (!reconnectDisabled) {
                ensureConnectionLocked();
            }
        }
    }

    protected abstract C openConnection(K key, ConnectionCallbacks callbacks);

    protected void onFlushFailed(Exception ignored) {
    }

    private void ensureConnectionLocked() {
        if (closed || reconnectDisabled) {
            return;
        }
        K key = desiredKey;
        if (key == null) {
            return;
        }
        if (connection != null && Objects.equals(connectionKey, key)) {
            return;
        }
        cancelReconnectLocked();
        closeConnectionLocked();
        connectionKey = key;
        connected = false;
        connection = openConnection(key, new ConnectionCallbacks() {
            @Override
            public void onConnected() {
                synchronized (lock) {
                    connected = true;
                    retryAttempts = 0;
                    cancelReconnectLocked();
                }
                flushPending();
            }

            @Override
            public void onDisconnected(boolean retryable) {
                synchronized (lock) {
                    connected = false;
                    if (!retryable) {
                        reconnectDisabled = true;
                        cancelReconnectLocked();
                        return;
                    }
                    if (closed) {
                        return;
                    }
                    scheduleReconnectLocked();
                }
            }

            @Override
            public void onError(Throwable error) {
                // défaut : on laisse onDisconnected() décider de la suite
            }
        });
    }

    private void flushPending() {
        C conn = connection;
        if (!connected || conn == null) {
            return;
        }
        Consumer<C> next;
        while ((next = pending.poll()) != null) {
            try {
                next.accept(conn);
            } catch (Exception ex) {
                pending.offer(next);
                onFlushFailed(ex);
                break;
            }
        }
    }

    private void scheduleReconnectLocked() {
        if (reconnectDisabled) {
            return;
        }
        if (scheduledReconnect != null && !scheduledReconnect.isDone()) {
            return;
        }
        retryAttempts = Math.min(retryAttempts + 1, MAX_BACKOFF_POWER);
        long delayMs = computeDelayMillis(retryAttempts);
        scheduledReconnect = reconnectExecutor.schedule(() -> {
            synchronized (lock) {
                scheduledReconnect = null;
                if (closed || reconnectDisabled || activeClients <= 0) {
                    return;
                }
                ensureConnectionLocked();
            }
        }, delayMs, TimeUnit.MILLISECONDS);
    }

    private long computeDelayMillis(int attempt) {
        int exponent = Math.max(0, attempt - 1);
        long base = INITIAL_RETRY_DELAY.toMillis() * (1L << exponent);
        base = Math.min(base, MAX_RETRY_DELAY.toMillis());
        long jitter = 250L + (long) (Math.random() * 1000L);
        return base + jitter;
    }

    private void cancelReconnectLocked() {
        if (scheduledReconnect != null) {
            scheduledReconnect.cancel(true);
            scheduledReconnect = null;
        }
    }

    private void closeConnectionLocked() {
        C current = connection;
        connection = null;
        connectionKey = null;
        if (current != null) {
            try {
                current.close();
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    public void close() {
        synchronized (lock) {
            if (closed) {
                return;
            }
            closed = true;
            activeClients = 0;
            desiredKey = null;
            cancelReconnectLocked();
            closeConnectionLocked();
            pending.clear();
            connected = false;
        }
        reconnectExecutor.shutdownNow();
    }

    private static final class NamedDaemonThreadFactory implements ThreadFactory {
        private final String prefix;
        private final AtomicInteger counter = new AtomicInteger(0);

        private NamedDaemonThreadFactory(String prefix) {
            this.prefix = prefix;
        }

        @Override
        public Thread newThread(Runnable r) {
            Thread t = new Thread(r, prefix + counter.getAndIncrement());
            t.setDaemon(true);
            return t;
        }
    }
}
