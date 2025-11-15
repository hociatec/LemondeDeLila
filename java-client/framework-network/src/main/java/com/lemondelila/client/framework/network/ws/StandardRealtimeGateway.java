package com.lemondelila.client.framework.network.ws;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.core.config.ConfigurationService;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.net.http.WebSocket.Listener;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class StandardRealtimeGateway implements RealtimeGateway {

    private static final Logger LOGGER = LoggerFactory.getLogger(StandardRealtimeGateway.class);
    private static final Duration INITIAL_RETRY_DELAY = Duration.ofSeconds(2);
    private static final Duration MAX_RETRY_DELAY = Duration.ofSeconds(30);
    private static final int MAX_BACKOFF_EXPONENT = 5;

    private final HttpClient httpClient;
    private final Supplier<URI> endpointSupplier;
    private final ObjectMapper objectMapper;
    private final DomainEventBus eventBus;
    private final CopyOnWriteArrayList<Consumer<JsonNode>> messageHandlers = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<Consumer<ConnectionState>> stateHandlers = new CopyOnWriteArrayList<>();
    private final Object lifecycleLock = new Object();

    private volatile WebSocket socket;
    private CompletableFuture<WebSocket> pendingConnection;
    private CompletableFuture<Void> scheduledReconnect;
    private boolean manualDisconnect;
    private int retryAttempts;

    public StandardRealtimeGateway(HttpClient httpClient,
                                   URI endpoint,
                                   ObjectMapper objectMapper,
                                   DomainEventBus eventBus) {
        this(httpClient, () -> Objects.requireNonNull(endpoint, "endpoint"), objectMapper, eventBus);
    }

    public StandardRealtimeGateway(HttpClient httpClient,
                                   Supplier<URI> endpointSupplier,
                                   ObjectMapper objectMapper,
                                   DomainEventBus eventBus) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.endpointSupplier = Objects.requireNonNull(endpointSupplier, "endpointSupplier");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
    }

    @Inject
    public StandardRealtimeGateway(HttpClient httpClient,
                                   ObjectMapper objectMapper,
                                   DomainEventBus eventBus,
                                   ConfigurationService configurationService) {
        this(httpClient,
                () -> URI.create(configurationService.get("network.ws.url", "ws://127.0.0.1:8080/ws")),
                objectMapper,
                eventBus);
    }

    @Override
    public void connect() {
        synchronized (lifecycleLock) {
            manualDisconnect = false;
            cancelScheduledReconnectLocked();
            if (socket != null || pendingConnection != null) {
                return;
            }
            startConnectionLocked();
        }
    }

    private void startConnectionLocked() {
        emitState(ConnectionState.CONNECTING);
        URI endpoint = endpointSupplier.get();
        CompletableFuture<WebSocket> future = httpClient.newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .buildAsync(endpoint, new ListenerImpl());
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
        emitState(ConnectionState.CONNECTED);
    }

    private void handleConnectFailureLocked(Throwable error) {
        LOGGER.error("Connexion WebSocket échouée", error);
        emitState(ConnectionState.FAILED);
        emitState(ConnectionState.CLOSED);
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
        LOGGER.warn("Reconnexion dans {} ms", delay);

        CompletableFuture<Void> marker = new CompletableFuture<>();
        scheduledReconnect = marker;
        CompletableFuture.delayedExecutor(delay, TimeUnit.MILLISECONDS)
                .execute(() -> {
                    synchronized (lifecycleLock) {
                        marker.complete(null);
                        if (manualDisconnect) {
                            scheduledReconnect = null;
                            return;
                        }
                        scheduledReconnect = null;
                        startConnectionLocked();
                    }
                });
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

    @Override
    public void disconnect(int statusCode, String reason) {
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
            } catch (Exception ex) {
                LOGGER.debug("Erreur lors de la fermeture du WebSocket", ex);
            }
        }
    }

    @Override
    public void send(JsonNode payload) {
        WebSocket current = socket;
        if (current == null) {
            throw new IllegalStateException("Socket non connecté");
        }
        try {
            String json = objectMapper.writeValueAsString(payload);
            current.sendText(json, true);
        } catch (Exception ex) {
            LOGGER.error("Impossible d'envoyer le message", ex);
        }
    }

    @Override
    public void onMessage(Consumer<JsonNode> handler) {
        messageHandlers.add(handler);
    }

    @Override
    public void onConnectionState(Consumer<ConnectionState> handler) {
        stateHandlers.add(handler);
    }

    private void emitState(ConnectionState state) {
        stateHandlers.forEach(h -> h.accept(state));
    }

    @Override
    public void close() {
        disconnect(WebSocket.NORMAL_CLOSURE, "closing");
    }

    private void handleSocketClosed(int statusCode, String reason) {
        synchronized (lifecycleLock) {
            socket = null;
            if (manualDisconnect) {
                return;
            }
            emitState(ConnectionState.CLOSED);
            scheduleReconnectLocked();
        }
    }

    private final class ListenerImpl implements Listener {
        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            webSocket.request(1);
            try {
                JsonNode node = objectMapper.readTree(data.toString());
                messageHandlers.forEach(handler -> handler.accept(node));
            } catch (Exception ex) {
                LOGGER.error("Message WebSocket invalide", ex);
            }
            return null;
        }

        @Override
        public void onOpen(WebSocket webSocket) {
            Listener.super.onOpen(webSocket);
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            eventBus.publish(new SocketClosed(statusCode, reason));
            handleSocketClosed(statusCode, reason);
            return Listener.super.onClose(webSocket, statusCode, reason);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            LOGGER.error("Erreur WebSocket", error);
            emitState(ConnectionState.FAILED);
            handleSocketClosed(-1, "error");
        }
    }

    public record SocketClosed(int statusCode, String reason) {
    }
}
