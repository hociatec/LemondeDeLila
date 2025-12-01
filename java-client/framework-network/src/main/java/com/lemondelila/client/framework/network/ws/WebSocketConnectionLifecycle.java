package com.lemondelila.client.framework.network.ws;

import com.lemondelila.client.framework.network.ws.RealtimeGateway.ConnectionState;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.net.http.WebSocket.Listener;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import java.util.function.Supplier;

final class WebSocketConnectionLifecycle {

    interface Delegate {
        void onOpen(WebSocket socket);

        void onText(CharSequence data);

        void onClosed(int statusCode, String reason);

        void onError(Throwable error);
    }

    private static final Duration INITIAL_RETRY_DELAY = Duration.ofSeconds(2);
    private static final Duration MAX_RETRY_DELAY = Duration.ofSeconds(30);
    private static final int MAX_BACKOFF_EXPONENT = 5;

    private final HttpClient httpClient;
    private final Supplier<URI> endpointSupplier;
    private final Duration connectTimeout;
    private final Delegate delegate;
    private final Consumer<ConnectionState> stateEmitter;
    private final ScheduledExecutorService reconnectExecutor =
            Executors.newSingleThreadScheduledExecutor(new ReconnectThreadFactory());

    private final Object lifecycleLock = new Object();
    private volatile WebSocket socket;
    private CompletableFuture<WebSocket> pendingConnection;
    private ScheduledFuture<?> scheduledReconnect;
    private boolean manualDisconnect;
    private int retryAttempts;

    WebSocketConnectionLifecycle(HttpClient httpClient,
                                 Supplier<URI> endpointSupplier,
                                 Duration connectTimeout,
                                 Delegate delegate,
                                 Consumer<ConnectionState> stateEmitter) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.endpointSupplier = Objects.requireNonNull(endpointSupplier, "endpointSupplier");
        this.connectTimeout = Objects.requireNonNull(connectTimeout, "connectTimeout");
        this.delegate = Objects.requireNonNull(delegate, "delegate");
        this.stateEmitter = Objects.requireNonNull(stateEmitter, "stateEmitter");
    }

    void connect() {
        synchronized (lifecycleLock) {
            manualDisconnect = false;
            cancelScheduledReconnectLocked();
            if (socket != null || pendingConnection != null) {
                return;
            }
            startConnectionLocked();
        }
    }

    void disconnect(int statusCode, String reason) {
        CompletableFuture<WebSocket> pending;
        WebSocket current;
        synchronized (lifecycleLock) {
            manualDisconnect = true;
            retryAttempts = 0;
            pending = pendingConnection;
            pendingConnection = null;
            current = socket;
            socket = null;
            cancelScheduledReconnectLocked();
        }
        if (pending != null) {
            pending.cancel(true);
        }
        if (current != null) {
            try {
                current.sendClose(statusCode, reason);
            } catch (Exception ignored) {
            }
        }
    }

    void close() {
        disconnect(WebSocket.NORMAL_CLOSURE, "closing");
    }

    private void startConnectionLocked() {
        emitState(ConnectionState.CONNECTING);
        URI endpoint = endpointSupplier.get();
        CompletableFuture<WebSocket> future = httpClient.newWebSocketBuilder()
                .connectTimeout(connectTimeout)
                .buildAsync(endpoint, new InternalListener());
        pendingConnection = future;
        future.whenComplete((ws, error) -> {
            synchronized (lifecycleLock) {
                pendingConnection = null;
                if (manualDisconnect) {
                    if (ws != null) {
                        try {
                            ws.sendClose(WebSocket.NORMAL_CLOSURE, "cancelled");
                        } catch (Exception ignored) {
                        }
                    }
                    return;
                }
                if (error != null) {
                    handleConnectFailureLocked(error);
                } else {
                    handleConnectSuccessLocked(ws);
                }
            }
        });
    }

    private void handleConnectSuccessLocked(WebSocket ws) {
        cancelScheduledReconnectLocked();
        socket = ws;
        retryAttempts = 0;
        delegate.onOpen(ws);
        emitState(ConnectionState.CONNECTED);
    }

    private void handleConnectFailureLocked(Throwable error) {
        emitState(ConnectionState.FAILED);
        emitState(ConnectionState.CLOSED);
        delegate.onError(error);
        scheduleReconnectLocked();
    }

    private void scheduleReconnectLocked() {
        if (manualDisconnect) {
            return;
        }
        if (scheduledReconnect != null && !scheduledReconnect.isDone()) {
            return;
        }
        retryAttempts = Math.min(retryAttempts + 1, MAX_BACKOFF_EXPONENT);
        long delay = computeBackoffDelayMillis();

        scheduledReconnect = reconnectExecutor.schedule(() -> {
            synchronized (lifecycleLock) {
                if (manualDisconnect) {
                    scheduledReconnect = null;
                    return;
                }
                scheduledReconnect = null;
                startConnectionLocked();
            }
        }, delay, TimeUnit.MILLISECONDS);
    }

    private long computeBackoffDelayMillis() {
        int exponent = Math.max(0, retryAttempts - 1);
        exponent = Math.min(exponent, MAX_BACKOFF_EXPONENT);
        long base = INITIAL_RETRY_DELAY.toMillis() * (1L << exponent);
        base = Math.min(base, MAX_RETRY_DELAY.toMillis());
        long jitter = ThreadLocalRandom.current().nextLong(250, 1250);
        return base + jitter;
    }

    private void cancelScheduledReconnectLocked() {
        if (scheduledReconnect != null) {
            scheduledReconnect.cancel(true);
            scheduledReconnect = null;
        }
    }

    private void handleSocketClosed(int statusCode, String reason) {
        synchronized (lifecycleLock) {
            socket = null;
            if (manualDisconnect) {
                return;
            }
            emitState(ConnectionState.CLOSED);
            delegate.onClosed(statusCode, reason);
            scheduleReconnectLocked();
        }
    }

    private void emitState(ConnectionState state) {
        stateEmitter.accept(state);
    }

    private static final class ReconnectThreadFactory implements ThreadFactory {
        private int counter;

        @Override
        public Thread newThread(Runnable r) {
            Thread thread = new Thread(r, "ws-reconnect-" + counter++);
            thread.setDaemon(true);
            return thread;
        }
    }

    private final class InternalListener implements Listener {

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            webSocket.request(1);
            delegate.onText(data);
            return null;
        }

        @Override
        public void onOpen(WebSocket webSocket) {
            Listener.super.onOpen(webSocket);
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            handleSocketClosed(statusCode, reason);
            return Listener.super.onClose(webSocket, statusCode, reason);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            delegate.onError(error);
            emitState(ConnectionState.FAILED);
            handleSocketClosed(-1, "error");
        }
    }
}
