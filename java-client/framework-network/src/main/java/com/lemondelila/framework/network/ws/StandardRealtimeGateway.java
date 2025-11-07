package com.lemondelila.framework.network.ws;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.framework.core.event.DomainEventBus;
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
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class StandardRealtimeGateway implements RealtimeGateway {

    private static final Logger LOGGER = LoggerFactory.getLogger(StandardRealtimeGateway.class);

    private final HttpClient httpClient;
    private final Supplier<URI> endpointSupplier;
    private final ObjectMapper objectMapper;
    private final DomainEventBus eventBus;
    private final CopyOnWriteArrayList<Consumer<JsonNode>> messageHandlers = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<Consumer<ConnectionState>> stateHandlers = new CopyOnWriteArrayList<>();
    private volatile WebSocket socket;

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

    @Override
    public void connect() {
        emitState(ConnectionState.CONNECTING);
        URI endpoint = endpointSupplier.get();
        httpClient.newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .buildAsync(endpoint, new ListenerImpl())
                .whenComplete((ws, error) -> {
                    if (error != null) {
                        LOGGER.error("Connexion WebSocket échouée", error);
                        emitState(ConnectionState.FAILED);
                        scheduleReconnect();
                    } else {
                        socket = ws;
                        emitState(ConnectionState.CONNECTED);
                    }
                });
    }

    private void scheduleReconnect() {
        emitState(ConnectionState.CLOSED);
        CompletableFuture.delayedExecutor(2, java.util.concurrent.TimeUnit.SECONDS)
                .execute(this::connect);
    }

    @Override
    public void disconnect(int statusCode, String reason) {
        WebSocket current = socket;
        if (current != null) {
            current.sendClose(statusCode, reason);
            socket = null;
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
            emitState(ConnectionState.CLOSED);
            eventBus.publish(new SocketClosed(statusCode, reason));
            return Listener.super.onClose(webSocket, statusCode, reason);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            emitState(ConnectionState.FAILED);
            LOGGER.error("Erreur WebSocket", error);
            scheduleReconnect();
        }
    }

    public record SocketClosed(int statusCode, String reason) {
    }
}
