package com.lemondelila.client.presence.transport;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.chat.model.ChatState;
import com.lemondelila.client.presence.model.PresenceActivity;
import com.lemondelila.client.presence.model.PresenceChat;
import com.lemondelila.client.presence.model.PresencePlayer;
import com.lemondelila.client.presence.dto.PresencePlayerDto;
import com.lemondelila.client.presence.dto.PresenceRoomDto;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
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

    public CompletableFuture<Void> updateContext(PresenceActivity activity, Integer roomId, String roomName) {
        WebSocket socket = socketRef.get();
        if (socket == null) {
            return CompletableFuture.failedFuture(new IllegalStateException("Socket non connectée"));
        }
        var payload = mapper.createObjectNode();
        payload.put("type", "presence-context");
        payload.put("context", mapActivity(activity));
        if (activity == PresenceActivity.TABLE && roomId != null) {
            payload.put("roomId", roomId);
            if (roomName != null && !roomName.isBlank()) {
                payload.put("roomName", roomName);
            }
        }
        String encoded;
        try {
            encoded = mapper.writeValueAsString(payload);
        } catch (IOException e) {
            return CompletableFuture.failedFuture(e);
        }
        return socket.sendText(encoded, true).thenApply(ws -> null);
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
                PresenceUpdateEnvelope envelope = mapper.readValue(data.toString(), PresenceUpdateEnvelope.class);
                if (envelope != null && "presence-update".equalsIgnoreCase(envelope.type())) {
                    List<PresencePlayer> players = toPresencePlayers(envelope.players());
                    lastPresence = players;
                    emitPresence(players);
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

    private List<PresencePlayer> toPresencePlayers(List<PresencePlayerDto> dtos) {
        if (dtos == null || dtos.isEmpty()) {
            return List.of();
        }
        List<PresencePlayer> players = new ArrayList<>(dtos.size());
        for (PresencePlayerDto dto : dtos) {
            players.add(toPresencePlayer(dto));
        }
        return List.copyOf(players);
    }

    private PresencePlayer toPresencePlayer(PresencePlayerDto dto) {
        if (dto == null) {
            return new PresencePlayer(-1, "inconnu", null, PresenceActivity.UNKNOWN);
        }
        PresenceChat currentRoom = null;
        PresenceRoomDto roomDto = dto.currentRoom();
        if (roomDto != null && roomDto.id() >= 0 && roomDto.name() != null && !roomDto.name().isBlank()) {
            currentRoom = new PresenceChat(roomDto.id(), roomDto.name());
        }
        String username = dto.username() == null || dto.username().isBlank() ? "inconnu" : dto.username();
        PresenceActivity activity = PresenceActivity.fromWire(dto.activity());
        return new PresencePlayer(dto.id(), username, currentRoom, activity);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record PresenceUpdateEnvelope(String type, List<PresencePlayerDto> players) {
    }

    private String mapActivity(PresenceActivity activity) {
        if (activity == null) {
            return "home";
        }
        return switch (activity) {
            case CHAT -> "chat";
            case TABLE -> "table";
            default -> "home";
        };
    }
}
