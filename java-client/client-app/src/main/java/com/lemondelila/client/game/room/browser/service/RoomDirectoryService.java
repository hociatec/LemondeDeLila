package com.lemondelila.client.game.room.browser.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.network.RealtimeApiClient;
import com.lemondelila.client.game.room.browser.model.PublicRoomSummary;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class RoomDirectoryService {

    private final RealtimeApiClient apiClient;

    public RoomDirectoryService(RealtimeApiClient apiClient) {
        this.apiClient = Objects.requireNonNull(apiClient, "apiClient");
    }

    public List<PublicRoomSummary> listPublicRooms(String gameType) throws IOException, InterruptedException {
        Map<String, Object> payload = gameType == null || gameType.isBlank()
                ? Map.of()
                : Map.of("gameType", gameType);
        JsonNode response = apiClient.request("rooms.public.list", payload, JsonNode.class);
        JsonNode groups = response.path("groups");
        JsonNode items = response.path("items");
        List<PublicRoomSummary> list = new ArrayList<>();

        if (groups.isArray()) {
            for (JsonNode group : groups) {
                JsonNode rooms = group.path("rooms");
                if (!rooms.isArray()) continue;
                for (JsonNode node : rooms) {
                    addRoomSummary(list, node);
                }
            }
        } else if (items.isArray()) {
            for (JsonNode node : items) {
                addRoomSummary(list, node);
            }
        }
        return List.copyOf(list);
    }

    private static void addRoomSummary(List<PublicRoomSummary> list, JsonNode node) {
        int id = node.path("id").asInt(-1);
        if (id <= 0) return;
        String name = node.path("name").asText("");
        String gt = node.path("gameType").asText("");
        String status = node.path("status").asText("");
        int maxPlayers = node.path("maxPlayers").asInt(0);
        int players = node.path("playersCount").asInt(0);
        int bots = node.path("botsCount").asInt(0);
        String owner = node.path("owner").path("username").asText(node.path("ownerUsername").asText(""));
        list.add(new PublicRoomSummary(id, name, gt, status, maxPlayers, players, bots, owner));
    }

    public JoinedRoom joinPublicRoom(int roomId) throws IOException, InterruptedException {
        JsonNode response = apiClient.request("rooms.public.join", Map.of("roomId", roomId), JsonNode.class);
        JsonNode room = response.path("room");
        int id = response.path("roomId").asInt(roomId);
        String gameType = room.path("gameType").asText("");
        String roomName = extractRoomName(room, response);
        return new JoinedRoom(id, gameType, roomName);
    }

    public JoinedRoom spectatePublicRoom(int roomId) throws IOException, InterruptedException {
        JsonNode response = apiClient.request("rooms.public.spectate", Map.of("roomId", roomId), JsonNode.class);
        JsonNode room = response.path("room");
        int id = response.path("roomId").asInt(roomId);
        String gameType = room.path("gameType").asText("");
        String roomName = extractRoomName(room, response);
        return new JoinedRoom(id, gameType, roomName);
    }

    public JoinedRoom respondInvite(String invitationId, boolean accept) throws IOException, InterruptedException {
        JsonNode response = apiClient.request("rooms.invite.respond", Map.of("invitationId", invitationId, "accept", accept), JsonNode.class);
        if (!accept) {
            return null;
        }
        JsonNode room = response.path("room");
        int id = response.path("roomId").asInt(room.path("id").asInt(-1));
        String gameType = room.path("gameType").asText("");
        String roomName = extractRoomName(room, response);
        if (id <= 0 || gameType.isBlank()) {
            return null;
        }
        return new JoinedRoom(id, gameType, roomName);
    }

    public void sendInvite(int roomId, int userId) throws IOException, InterruptedException {
        apiClient.request("rooms.invite.send", Map.of("roomId", roomId, "userId", userId), JsonNode.class);
    }

    public record JoinedRoom(int roomId, String gameType, String roomName) {
    }

    private static String extractRoomName(JsonNode room, JsonNode response) {
        String name = room.path("name").asText("");
        if (name == null || name.isBlank()) {
            name = response.path("name").asText("");
        }
        if (name == null || name.isBlank()) {
            return "";
        }
        return name;
    }
}
