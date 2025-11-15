package com.lemondelila.client.chat.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

public final class ChatConnection implements AutoCloseable {

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final URI endpoint;
    private final CopyOnWriteArrayList<Consumer<List<ChatMessage>>> historyHandlers = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<Consumer<ChatMessage>> messageHandlers = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<Consumer<ChatState>> stateHandlers = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<Consumer<String>> errorHandlers = new CopyOnWriteArrayList<>();
    private final AtomicReference<WebSocket> socketRef = new AtomicReference<>();

    public ChatConnection(HttpClient httpClient, ObjectMapper mapper, URI endpoint) {
        this.httpClient = httpClient;
        this.mapper = mapper;
        this.endpoint = endpoint;
    }

    public CompletableFuture<Void> connect() {
        emitState(ChatState.CONNECTING);
        return httpClient.newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .buildAsync(endpoint, new ListenerImpl())
                .thenAccept(socket -> {
                    socketRef.set(socket);
                    emitState(ChatState.CONNECTED);
                })
                .exceptionally(throwable -> {
                    emitState(ChatState.FAILED);
                    emitError("Connexion au tchat impossible : " + throwable.getMessage());
                    return null;
                });
    }

    public CompletableFuture<Void> sendMessage(String text) {
        String trimmed = text == null ? "" : text.trim();
        if (trimmed.isEmpty()) {
            return CompletableFuture.completedFuture(null);
        }
        WebSocket socket = socketRef.get();
        if (socket == null) {
            return CompletableFuture.failedFuture(new IllegalStateException("Socket non connectée"));
        }
        ObjectNode payload = mapper.createObjectNode();
        payload.put("type", "chat-send");
        payload.put("text", trimmed);
        String encoded;
        try {
            encoded = mapper.writeValueAsString(payload);
        } catch (IOException e) {
            return CompletableFuture.failedFuture(e);
        }
        return socket.sendText(encoded, true)
                .thenRun(() -> { })
                .exceptionally(throwable -> {
                    emitError("Envoi impossible : " + throwable.getMessage());
                    return null;
                });
    }

    public void onHistory(Consumer<List<ChatMessage>> handler) {
        historyHandlers.add(handler);
    }

    public void onMessage(Consumer<ChatMessage> handler) {
        messageHandlers.add(handler);
    }

    public void onState(Consumer<ChatState> handler) {
        stateHandlers.add(handler);
    }

    public void onError(Consumer<String> handler) {
        errorHandlers.add(handler);
    }

    private void emitState(ChatState state) {
        stateHandlers.forEach(handler -> handler.accept(state));
    }

    private void emitError(String message) {
        errorHandlers.forEach(handler -> handler.accept(message));
    }

    private void dispatchHistory(JsonNode node) {
        JsonNode messagesNode = node.path("messages");
        if (!messagesNode.isArray()) {
            return;
        }
        List<ChatMessage> messages = new ArrayList<>();
        messagesNode.forEach(item -> parseMessage(item).ifPresent(messages::add));
        if (!messages.isEmpty()) {
            historyHandlers.forEach(handler -> handler.accept(messages));
        }
    }

    private void dispatchMessage(JsonNode node) {
        parseMessage(node).ifPresent(message -> messageHandlers.forEach(handler -> handler.accept(message)));
    }

    private java.util.Optional<ChatMessage> parseMessage(JsonNode node) {
        if (node == null || !node.isObject()) {
            return java.util.Optional.empty();
        }
        JsonNode userNode = node.path("user");
        String username = userNode.path("username").asText("inconnu");
        String text = node.path("text").asText("");
        long id = node.path("id").asLong(System.nanoTime());
        String created = node.path("createdAt").asText("");
        Instant createdAt;
        try {
            createdAt = created.isEmpty() ? Instant.now() : Instant.parse(created);
        } catch (Exception e) {
            createdAt = Instant.now();
        }
        return java.util.Optional.of(new ChatMessage(id, username, text, createdAt));
    }

    @Override
    public void close() {
        WebSocket socket = socketRef.getAndSet(null);
        if (socket != null) {
            socket.sendClose(WebSocket.NORMAL_CLOSURE, "closing");
        }
    }

    private final class ListenerImpl implements WebSocket.Listener {

        @Override
        public void onOpen(WebSocket webSocket) {
            webSocket.request(1);
            WebSocket.Listener.super.onOpen(webSocket);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            webSocket.request(1);
            try {
                JsonNode node = mapper.readTree(data.toString());
                String type = node.path("type").asText();
                if ("chat-history".equals(type)) {
                    dispatchHistory(node);
                } else if ("chat-message".equals(type)) {
                    dispatchMessage(node);
                }
            } catch (Exception e) {
                emitError("Message tchat invalide : " + e.getMessage());
            }
            return null;
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            emitState(ChatState.CLOSED);
            return WebSocket.Listener.super.onClose(webSocket, statusCode, reason);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            emitState(ChatState.FAILED);
            emitError("WebSocket tchat : " + error.getMessage());
        }
    }
}
