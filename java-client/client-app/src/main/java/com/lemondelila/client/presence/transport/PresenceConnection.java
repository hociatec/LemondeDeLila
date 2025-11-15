package com.lemondelila.client.presence.transport;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.chat.model.ChatState;
import com.lemondelila.client.presence.model.PresenceChat;
import com.lemondelila.client.presence.model.PresencePlayer;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

public final class PresenceConnection implements AutoCloseable {

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final URI endpoint;
    private final CopyOnWriteArrayList<Consumer<List<PresencePlayer>>> presenceHandlers = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<Consumer<ChatState>> stateHandlers = new CopyOnWriteArrayList<>();
    private final CopyOnWriteArrayList<Consumer<String>> errorHandlers = new CopyOnWriteArrayList<>();
    private final AtomicReference<WebSocket> socketRef = new AtomicReference<>();
    private volatile List<PresencePlayer> lastPresence = List.of();

    public PresenceConnection(HttpClient httpClient, ObjectMapper mapper, URI endpoint) {
        this.httpClient = httpClient;
        this.mapper = mapper;
        this.endpoint = endpoint;
    }

    public void connect() {
        emitState(ChatState.CONNECTING);
        httpClient.newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .buildAsync(endpoint, new Listener())
                .thenAccept(socket -> {
                    socketRef.set(socket);
                    emitState(ChatState.CONNECTED);
                })
                .exceptionally(error -> {
                    emitState(ChatState.FAILED);
                    emitError("Connexion presence impossible : " + error.getMessage());
                    return null;
                });
    }

    public void onPresence(Consumer<List<PresencePlayer>> handler) {
        presenceHandlers.add(handler);
        if (!lastPresence.isEmpty()) {
            handler.accept(List.copyOf(lastPresence));
        }
    }

    public void onState(Consumer<ChatState> handler) {
        stateHandlers.add(handler);
    }

    public void onError(Consumer<String> handler) {
        errorHandlers.add(handler);
    }

    public List<PresencePlayer> latestPresence() {
        return List.copyOf(lastPresence);
    }

    private void emitState(ChatState state) {
        stateHandlers.forEach(handler -> handler.accept(state));
    }

    private void emitError(String message) {
        errorHandlers.forEach(handler -> handler.accept(message));
    }

    private void emitPresence(List<PresencePlayer> players) {
        presenceHandlers.forEach(handler -> handler.accept(players));
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
                JsonNode node = mapper.readTree(data.toString());
                if ("presence-update".equals(node.path("type").asText())) {
                    JsonNode playersNode = node.path("players");
                    if (playersNode.isArray()) {
                        List<PresencePlayer> players = new ArrayList<>();
                        playersNode.forEach(item -> parsePresence(item).ifPresent(players::add));
                        lastPresence = players;
                        emitPresence(players);
                    }
                }
            } catch (Exception e) {
                emitError("Presence invalide : " + e.getMessage());
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
            emitError("Presence WS : " + error.getMessage());
        }
    }

    private java.util.Optional<PresencePlayer> parsePresence(JsonNode node) {
        if (node == null || !node.isObject()) {
            return java.util.Optional.empty();
        }
        int id = node.path("id").asInt(-1);
        String username = node.path("username").asText("inconnu");
        List<PresenceChat> rooms = new ArrayList<>();
        JsonNode roomsNode = node.path("rooms");
        if (roomsNode.isArray()) {
            roomsNode.forEach(room -> {
                int roomId = room.path("id").asInt(-1);
                String name = room.path("name").asText("");
                if (roomId >= 0 && !name.isEmpty()) {
                    rooms.add(new PresenceChat(roomId, name));
                }
            });
        }
        return java.util.Optional.of(new PresencePlayer(id, username, rooms));
    }
}
