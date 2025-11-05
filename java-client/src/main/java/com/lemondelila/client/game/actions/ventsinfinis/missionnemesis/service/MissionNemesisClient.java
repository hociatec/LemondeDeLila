package com.lemondelila.client.game.actions.ventsinfinis.missionnemesis.service;

import com.lemondelila.client.config.ClientConfig;
import com.lemondelila.client.game.actions.ventsinfinis.missionnemesis.model.MissionNemesisState;
import com.lemondelila.client.session.service.SessionService;
import com.google.gson.Gson;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;

public class MissionNemesisClient {

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final SessionService sessionService;
    private final ClientConfig config;
    private final Gson gson = new Gson();
    private WebSocketClient webSocketClient;

    public MissionNemesisClient(SessionService sessionService, ClientConfig config) {
        this.sessionService = sessionService;
        this.config = config;
    }

    public void connect(String roomId, Consumer<MissionNemesisState> onStateUpdate) {
        try {
            URI wsUri = new URI("ws://" + config.apiBaseUri().getHost() + ":9090");
            webSocketClient = new WebSocketClient(wsUri) {
                @Override
                public void onOpen(ServerHandshake handshakedata) {
                    System.out.println("WebSocket connection opened");
                }

                @Override
                public void onMessage(String message) {
                    MissionNemesisState state = gson.fromJson(message, MissionNemesisState.class);
                    onStateUpdate.accept(state);
                }

                @Override
                public void onClose(int code, String reason, boolean remote) {
                    System.out.println("WebSocket connection closed");
                }

                @Override
                public void onError(Exception ex) {
                    ex.printStackTrace();
                }
            };
            webSocketClient.connect();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void disconnect() {
        if (webSocketClient != null) {
            webSocketClient.close();
        }
    }

    public MissionNemesisState placeShips(String roomId, Object ships) throws Exception {
        String json = gson.toJson(ships);
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(config.apiBaseUri().resolve("games/mission-nemesis/rooms/" + roomId + "/move"))
                .header("Content-Type", "application/json");
        sessionService.token().ifPresent(token -> builder.header("Authorization", "Bearer " + token));
        HttpRequest request = builder.POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8)).build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        return gson.fromJson(response.body(), MissionNemesisState.class);
    }

    public MissionNemesisState fireShot(String roomId, int x, int y) throws Exception {
        String json = "{\"action\":\"fire\",\"coordinates\":{\"x\":" + x + ",\"y\":" + y + "}}";
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(config.apiBaseUri().resolve("games/mission-nemesis/rooms/" + roomId + "/move"))
                .header("Content-Type", "application/json");
        sessionService.token().ifPresent(token -> builder.header("Authorization", "Bearer " + token));
        HttpRequest request = builder.POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8)).build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        return gson.fromJson(response.body(), MissionNemesisState.class);
    }

    public MissionNemesisState getState(String roomId) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(config.apiBaseUri().resolve("games/mission-nemesis/rooms/" + roomId + "/state"))
                .header("Content-Type", "application/json");
        sessionService.token().ifPresent(token -> builder.header("Authorization", "Bearer " + token));
        HttpRequest request = builder.GET().build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        return gson.fromJson(response.body(), MissionNemesisState.class);
    }
}
