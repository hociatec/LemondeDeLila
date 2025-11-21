package com.lemondelila.client.game.room.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.PlayerState;
import com.lemondelila.client.game.room.model.RoomState;
import com.lemondelila.client.game.room.model.SnapshotInfo;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

public final class RoomApiService {

    private final RestClient restClient;

    public RoomApiService(RestClient restClient) {
        this.restClient = restClient;
    }

    public RoomState createRoom(String name, String gameType, int maxPlayers, boolean isPrivate) throws IOException, InterruptedException {
        // Le backend attend un POST sur /api/rooms/ (avec slash)
        JsonNode json = restClient.post("rooms/", Map.of(
                "name", name,
                "gameType", gameType,
                "maxPlayers", maxPlayers,
                "isPrivate", isPrivate
        ));
        int id = json.path("id").asInt();
        RoomState room = new RoomState()
                .withId(id)
                .withName(name)
                .withGameType(gameType)
                .withMaxPlayers(maxPlayers)
                .withStatus("open");
        return room;
    }

    public void joinRoom(int roomId) throws IOException, InterruptedException {
        restClient.post("rooms/" + roomId + "/join", Collections.emptyMap());
    }

    public void leaveRoom(int roomId) throws IOException, InterruptedException {
        restClient.post("rooms/" + roomId + "/leave", Collections.emptyMap());
    }

    public void startRoom(int roomId) throws IOException, InterruptedException {
        restClient.post("rooms/" + roomId + "/start", Collections.emptyMap());
    }

    public RoomState fetchRoom(int roomId) throws IOException, InterruptedException {
        JsonNode json = restClient.get("rooms/" + roomId);
        return mapRoom(json);
    }

    public List<RoomState> listRooms() throws IOException, InterruptedException {
        JsonNode json = restClient.get("rooms");
        List<RoomState> list = new ArrayList<>();
        if (json.isArray()) {
            json.forEach(node -> list.add(mapRoom(node)));
        }
        return list;
    }

    private static RoomState mapRoom(JsonNode json) {
        return RoomMapper.mapRoom(json);
    }

    public List<SnapshotInfo> listSnapshots(int roomId) throws IOException, InterruptedException {
        JsonNode json = restClient.get("rooms/" + roomId + "/snapshots");
        List<SnapshotInfo> list = new ArrayList<>();
        if (json.isArray()) {
            json.forEach(node -> list.add(new SnapshotInfo(
                    node.path("id").isInt() ? node.get("id").asInt() : null,
                    node.path("label").asText(""),
                    node.path("createdAt").asText("")
            )));
        }
        return list;
    }

    public void createSnapshot(int roomId, String label) throws IOException, InterruptedException {
        restClient.post("rooms/" + roomId + "/snapshot", Map.of("label", label == null ? "" : label));
    }

    public void restoreSnapshot(int roomId, int snapshotId) throws IOException, InterruptedException {
        restClient.post("rooms/" + roomId + "/restore/" + snapshotId, Collections.emptyMap());
    }
}
