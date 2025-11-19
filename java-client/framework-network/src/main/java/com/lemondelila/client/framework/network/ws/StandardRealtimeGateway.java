package com.lemondelila.client.framework.network.ws;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import com.lemondelila.client.framework.network.ws.WebSocketConnectionLifecycle.Delegate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class StandardRealtimeGateway implements RealtimeGateway, Delegate {

    private static final Logger LOGGER = LoggerFactory.getLogger(StandardRealtimeGateway.class);
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);

    private final ObjectMapper objectMapper;
    private final DomainEventBus eventBus;
    private final CopyOnWriteArrayList<Consumer<JsonNode>> messageHandlers = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<Consumer<ConnectionState>> stateHandlers = new CopyOnWriteArrayList<>();
    private final WebSocketConnectionLifecycle lifecycle;
    private final Object lifecycleLock = new Object();
    private boolean closed;

    private volatile WebSocket currentSocket;

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
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        Objects.requireNonNull(endpointSupplier, "endpointSupplier");
        this.lifecycle = new WebSocketConnectionLifecycle(
                Objects.requireNonNull(httpClient, "httpClient"),
                endpointSupplier,
                CONNECT_TIMEOUT,
                this,
                this::emitState
        );
    }

    @Inject
    public StandardRealtimeGateway(HttpClient httpClient,
                                   ObjectMapper objectMapper,
                                   DomainEventBus eventBus,
                                   NetworkEndpoints endpoints) {
        this(httpClient,
                endpoints::realtimeGateway,
                objectMapper,
                eventBus);
    }

    @Override
    public void connect() {
        lifecycle.connect();
    }

    @Override
    public void disconnect(int statusCode, String reason) {
        lifecycle.disconnect(statusCode, reason);
    }

    @Override
    public void send(JsonNode payload) {
        WebSocket socket = currentSocket;
        if (socket == null) {
            throw new IllegalStateException("Socket non connecté");
        }
        try {
            String json = objectMapper.writeValueAsString(payload);
            socket.sendText(json, true);
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

    @Override
    public void close() {
        synchronized (lifecycleLock) {
            if (closed) {
                return;
            }
            closed = true;
        }
        lifecycle.close();
    }

    private void emitState(ConnectionState state) {
        stateHandlers.forEach(handler -> {
            try {
                handler.accept(state);
            } catch (Exception ignored) {
            }
        });
    }

    @Override
    public void onOpen(WebSocket socket) {
        this.currentSocket = socket;
    }

    @Override
    public void onText(CharSequence data) {
        try {
            JsonNode node = objectMapper.readTree(data.toString());
            messageHandlers.forEach(handler -> handler.accept(node));
        } catch (Exception ex) {
            LOGGER.error("Message WebSocket invalide", ex);
        }
    }

    @Override
    public void onClosed(int statusCode, String reason) {
        currentSocket = null;
        eventBus.publish(new SocketClosed(statusCode, reason));
    }

    @Override
    public void onError(Throwable error) {
        LOGGER.error("Erreur WebSocket", error);
    }

    public record SocketClosed(int statusCode, String reason) {
    }
}
