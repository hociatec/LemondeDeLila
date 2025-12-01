package com.lemondelila.client.presence.service;

import com.lemondelila.client.chat.model.ChatState;
import com.lemondelila.client.presence.event.PresenceErrorEvent;
import com.lemondelila.client.presence.event.PresenceEvent;
import com.lemondelila.client.presence.event.PresenceEventListener;
import com.lemondelila.client.presence.event.PresenceStateChangedEvent;
import com.lemondelila.client.presence.event.PresenceUpdateEvent;
import com.lemondelila.client.presence.model.PresencePlayer;
import com.lemondelila.client.presence.transport.PresenceConnection;

import java.time.Duration;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;

/**
 * Service responsable de la connexion temps réel de présence.
 */
public final class PresenceRealtimeService {

    private static final Duration INITIAL_RETRY_DELAY = Duration.ofSeconds(2);
    private static final Duration MAX_RETRY_DELAY = Duration.ofSeconds(30);
    private static final int MAX_BACKOFF_POWER = 5;

    private final PresenceConnectionFactory connectionFactory;
    private final CopyOnWriteArrayList<PresenceEventListener> listeners = new CopyOnWriteArrayList<>();
    private final ScheduledExecutorService reconnectExecutor =
            Executors.newSingleThreadScheduledExecutor(new PresenceThreadFactory());

    private volatile PresenceConnection connection;
    private volatile List<PresencePlayer> lastPresence = List.of();
    private ScheduledFuture<?> pendingReconnect;
    private int retryAttempts;
    private int activeClients;

    public PresenceRealtimeService(PresenceConnectionFactory connectionFactory) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
    }

    public synchronized void start() {
        activeClients++;
        if (connection == null) {
            openConnectionLocked();
        }
    }

    public synchronized void stop() {
        if (activeClients == 0) {
            return;
        }
        activeClients--;
        if (activeClients == 0) {
            cancelReconnectLocked();
            closeConnectionLocked();
            retryAttempts = 0;
        }
    }

    public List<PresencePlayer> latestPresence() {
        return lastPresence == null ? List.of() : List.copyOf(lastPresence);
    }

    public void addListener(PresenceEventListener listener) {
        listeners.add(listener);
    }

    public void removeListener(PresenceEventListener listener) {
        listeners.remove(listener);
    }

    private void emit(PresenceEvent event) {
        listeners.forEach(listener -> listener.onEvent(event));
    }

    private void openConnectionLocked() {
        cancelReconnectLocked();
        PresenceConnection conn = connectionFactory.open();
        connection = conn;
        conn.onPresence(players -> {
            lastPresence = players;
            emit(new PresenceUpdateEvent(players));
        });
        conn.onState(state -> {
            emit(new PresenceStateChangedEvent(state));
            handleStateChange(state);
        });
        conn.onError(error -> emit(new PresenceErrorEvent(error)));
        lastPresence = conn.latestPresence();
        conn.connect();
    }

    private void handleStateChange(ChatState state) {
        if (state == ChatState.CONNECTED) {
            synchronized (this) {
                retryAttempts = 0;
                cancelReconnectLocked();
            }
            return;
        }
        if (state == ChatState.CLOSED || state == ChatState.FAILED) {
            synchronized (this) {
                if (activeClients == 0) {
                    return;
                }
                closeConnectionLocked();
                scheduleReconnectLocked();
            }
        }
    }

    private void closeConnectionLocked() {
        PresenceConnection conn = connection;
        connection = null;
        if (conn != null) {
            conn.close();
        }
    }

    private void scheduleReconnectLocked() {
        if (pendingReconnect != null && !pendingReconnect.isDone()) {
            return;
        }
        retryAttempts = Math.min(retryAttempts + 1, MAX_BACKOFF_POWER);
        long delay = computeDelayMillis(retryAttempts);
        pendingReconnect = reconnectExecutor.schedule(() -> {
            synchronized (PresenceRealtimeService.this) {
                pendingReconnect = null;
                if (activeClients == 0) {
                    return;
                }
                openConnectionLocked();
            }
        }, delay, TimeUnit.MILLISECONDS);
    }

    private void cancelReconnectLocked() {
        if (pendingReconnect != null) {
            pendingReconnect.cancel(true);
            pendingReconnect = null;
        }
    }

    private long computeDelayMillis(int attempt) {
        int exponent = Math.max(0, attempt - 1);
        long base = INITIAL_RETRY_DELAY.toMillis() * (1L << exponent);
        return Math.min(base, MAX_RETRY_DELAY.toMillis());
    }

    private static final class PresenceThreadFactory implements ThreadFactory {
        private int counter;

        @Override
        public Thread newThread(Runnable r) {
            Thread thread = new Thread(r, "presence-reconnect-" + counter++);
            thread.setDaemon(true);
            return thread;
        }
    }
}
