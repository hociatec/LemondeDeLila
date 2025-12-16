package com.lemondelila.client.notification.transport;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

public final class NotificationConnection implements AutoCloseable {

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final URI endpoint;
    private final CopyOnWriteArrayList<Consumer<Envelope>> messageHandlers = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<Consumer<String>> errorHandlers = new CopyOnWriteArrayList<>();
    private final AtomicReference<WebSocket> socketRef = new AtomicReference<>();

    public NotificationConnection(HttpClient httpClient, ObjectMapper mapper, URI endpoint) {
        this.httpClient = httpClient;
        this.mapper = mapper;
        this.endpoint = endpoint;
    }

    public void connect() {
        httpClient.newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .buildAsync(endpoint, new Listener())
                .thenAccept(socketRef::set)
                .exceptionally(error -> {
                    emitError("Connexion notifications impossible : " + error.getMessage());
                    return null;
                });
    }

    public void onMessage(Consumer<Envelope> handler) {
        messageHandlers.add(handler);
    }

    public void onError(Consumer<String> handler) {
        errorHandlers.add(handler);
    }

    private void emitMessage(Envelope envelope) {
        messageHandlers.forEach(handler -> handler.accept(envelope));
    }

    private void emitError(String message) {
        errorHandlers.forEach(handler -> handler.accept(message));
    }

    @Override
    public void close() {
        WebSocket socket = socketRef.getAndSet(null);
        if (socket != null) {
            socket.sendClose(WebSocket.NORMAL_CLOSURE, "closing");
        }
    }

    private final class Listener implements WebSocket.Listener {

        @Override
        public void onOpen(WebSocket webSocket) {
            webSocket.request(1);
            WebSocket.Listener.super.onOpen(webSocket);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            webSocket.request(1);
            try {
                Envelope envelope = mapper.readValue(data.toString(), Envelope.class);
                if (envelope != null && envelope.type() != null && !envelope.type().isBlank()) {
                    emitMessage(envelope);
                }
            } catch (Exception e) {
                emitError("Notification invalide : " + e.getMessage());
            }
            return null;
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            return WebSocket.Listener.super.onClose(webSocket, statusCode, reason);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            emitError("Notifications WS : " + error.getMessage());
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Envelope(String type, JsonNode payload) {
    }
}

