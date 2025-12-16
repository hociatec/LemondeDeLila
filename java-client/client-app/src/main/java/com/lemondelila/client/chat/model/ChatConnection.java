package com.lemondelila.client.chat.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lemondelila.client.presence.model.PresencePlayer;
import com.lemondelila.client.presence.model.PresenceChat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

public final class ChatConnection implements AutoCloseable {

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final URI endpoint;
    private final String authorizationHeader;
    private final com.lemondelila.client.framework.core.task.TaskScheduler scheduler;
    private final CopyOnWriteArrayList<Consumer<List<ChatMessage>>> historyHandlers = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<Consumer<ChatMessage>> messageHandlers = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<Consumer<List<PresencePlayer>>> presenceHandlers = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<Consumer<ChatState>> stateHandlers = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<Consumer<String>> errorHandlers = new CopyOnWriteArrayList<>();
    private final AtomicReference<WebSocket> socketRef = new AtomicReference<>();
    private volatile List<PresencePlayer> lastPresence = List.of();
    private final Duration heartbeatInterval = Duration.ofSeconds(25);
    private final Duration reconnectDelay = Duration.ofSeconds(5);
    private volatile ScheduledFuture<?> heartbeatTask;
    private volatile ScheduledFuture<?> reconnectTask;
    private volatile boolean closing;

    public ChatConnection(HttpClient httpClient,
                          ObjectMapper mapper,
                          URI endpoint,
                          String authorizationHeader,
                          com.lemondelila.client.framework.core.task.TaskScheduler scheduler) {
        this.httpClient = httpClient;
        this.mapper = mapper;
        this.endpoint = endpoint;
        this.authorizationHeader = authorizationHeader;
        this.scheduler = scheduler;
    }

    public CompletableFuture<Void> connect() {
        closing = false;
        cancelReconnect();
        emitState(ChatState.CONNECTING);
        return establishConnection();
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

    public void onPresence(Consumer<List<PresencePlayer>> handler) {
        presenceHandlers.add(handler);
        if (!lastPresence.isEmpty()) {
            handler.accept(List.copyOf(lastPresence));
        }
    }

    public List<PresencePlayer> latestPresence() {
        return List.copyOf(lastPresence);
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

    private void dispatchPresence(JsonNode node) {
        JsonNode playersNode = node.path("players");
        if (!playersNode.isArray()) {
            return;
        }
        List<PresencePlayer> players = new ArrayList<>();
        playersNode.forEach(item -> parsePresence(item).ifPresent(players::add));
        lastPresence = players;
        presenceHandlers.forEach(handler -> handler.accept(players));
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
        closing = true;
        cancelHeartbeat();
        cancelReconnect();
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
            startHeartbeat();
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
                } else if ("presence-update".equals(type)) {
                    dispatchPresence(node);
                }
            } catch (Exception e) {
                emitError("Message tchat invalide : " + e.getMessage());
            }
            return null;
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            emitState(ChatState.CLOSED);
            socketRef.compareAndSet(webSocket, null);
            cancelHeartbeat();
            attemptReconnect();
            return WebSocket.Listener.super.onClose(webSocket, statusCode, reason);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            emitState(ChatState.FAILED);
            emitError("WebSocket tchat : " + error.getMessage());
            socketRef.compareAndSet(webSocket, null);
            cancelHeartbeat();
            attemptReconnect();
        }
    }

    private java.util.Optional<PresencePlayer> parsePresence(JsonNode node) {
        if (node == null || !node.isObject()) {
            return java.util.Optional.empty();
        }
        int id = node.path("id").asInt(-1);
        String username = node.path("username").asText("inconnu");
        PresenceChat currentRoom = null;
        JsonNode roomNode = node.path("currentRoom");
        if (roomNode != null && !roomNode.isMissingNode() && roomNode.isObject()) {
            int roomId = roomNode.path("id").asInt(-1);
            String name = roomNode.path("name").asText("");
            if (roomId >= 0 && !name.isEmpty()) {
                currentRoom = new PresenceChat(roomId, name);
            }
        }
        return java.util.Optional.of(new PresencePlayer(id, username, currentRoom));
    }

    private CompletableFuture<Void> establishConnection() {
        return httpClient.newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .header("Authorization", authorizationHeader)
                .buildAsync(endpoint, new ListenerImpl())
                .thenAccept(socket -> {
                    socketRef.set(socket);
                    emitState(ChatState.CONNECTED);
                })
                .exceptionally(throwable -> {
                    emitState(ChatState.FAILED);
                    emitError("Connexion au tchat impossible : " + throwable.getMessage());
                    attemptReconnect();
                    return null;
                });
    }

    private void startHeartbeat() {
        cancelHeartbeat();
        heartbeatTask = scheduler.scheduleAtFixedRate(
                () -> {
                    WebSocket socket = socketRef.get();
                    if (socket != null) {
                        socket.sendPing(ByteBuffer.wrap(new byte[]{1}));
                    }
                },
                heartbeatInterval,
                heartbeatInterval);
    }

    private void cancelHeartbeat() {
        ScheduledFuture<?> task = heartbeatTask;
        if (task != null) {
            task.cancel(true);
            heartbeatTask = null;
        }
    }

    private void attemptReconnect() {
        if (closing) {
            return;
        }
        if (reconnectTask != null && !reconnectTask.isDone()) {
            return;
        }
        reconnectTask = scheduler.schedule(() -> {
            if (closing) {
                return;
            }
            emitState(ChatState.CONNECTING);
            establishConnection();
        }, reconnectDelay);
    }

    private void cancelReconnect() {
        ScheduledFuture<?> task = reconnectTask;
        if (task != null) {
            task.cancel(true);
            reconnectTask = null;
        }
    }
}
