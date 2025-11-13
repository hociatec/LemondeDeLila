package com.lemondelila.client.gamelogic.missionnemesis.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState.Ship;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState.Shot;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

public final class NemesisStateMapper {

    private NemesisStateMapper() {
    }

    public static NemesisState fromJson(JsonNode root) throws IOException {
        if (root == null || !root.isObject()) {
            throw new IOException("Etat Mission Nemesis invalide");
        }

        String type = root.path("type").asText("mission-nemesis");
        int turnIndex = root.path("turnIndex").asInt(0);
        String status = root.path("status").asText("placement");
        Integer winnerId = root.hasNonNull("winner") ? root.get("winner").asInt() : null;
        int round = root.path("round").asInt(1);

        List<NemesisState.Player> players = new ArrayList<>();
        JsonNode playersNode = root.path("players");
        if (playersNode.isArray()) {
            for (JsonNode playerNode : playersNode) {
                players.add(readPlayer(playerNode));
            }
        }

        List<NemesisState.LogEntry> logEntries = new ArrayList<>();
        JsonNode logNode = root.path("log");
        if (logNode.isArray()) {
            for (JsonNode entry : logNode) {
                logEntries.add(readLog(entry));
            }
        }

        return new NemesisState(
                type,
                players,
                turnIndex,
                status,
                winnerId,
                round,
                logEntries
        );
    }

    private static NemesisState.Player readPlayer(JsonNode node) {
        int id = node.path("id").asInt(-1);
        String username = node.path("username").asText("Inconnu");
        String status = node.path("status").asText("placing");

        List<Ship> ships = new ArrayList<>();
        JsonNode shipsNode = node.path("ships");
        if (shipsNode.isArray()) {
            for (JsonNode shipNode : shipsNode) {
                ships.add(readShip(shipNode));
            }
        }

        List<Shot> shots = new ArrayList<>();
        JsonNode shotsNode = node.path("shots");
        if (shotsNode.isArray()) {
            for (JsonNode shotNode : shotsNode) {
                shots.add(readShot(shotNode));
            }
        }

        return new NemesisState.Player(id, username, ships, shots, status);
    }

    private static Ship readShip(JsonNode node) {
        String name = node.path("name").asText("Inconnu");
        List<NemesisState.Coordinate> coordinates = new ArrayList<>();
        JsonNode coordsNode = node.has("coordinates") ? node.get("coordinates") : node.get("coords");
        if (coordsNode != null && coordsNode.isArray()) {
            for (JsonNode coordNode : coordsNode) {
                coordinates.add(new NemesisState.Coordinate(
                        coordNode.path("x").asInt(),
                        coordNode.path("y").asInt()
                ));
            }
        }

        boolean[] hits = readHits(node.path("hits"), coordinates.size());

        return new Ship(name, coordinates, hits);
    }

    private static boolean[] readHits(JsonNode node, int size) {
        boolean[] hits = new boolean[size];
        if (node != null && node.isArray()) {
            Iterator<JsonNode> iterator = node.iterator();
            int index = 0;
            while (iterator.hasNext() && index < size) {
                hits[index] = iterator.next().asBoolean(false);
                index++;
            }
        }
        return hits;
    }

    private static Shot readShot(JsonNode node) {
        int x = node.path("x").asInt();
        int y = node.path("y").asInt();
        int targetId = node.path("targetId").asInt(-1);
        String result = node.path("result").asText("miss");
        return new Shot(x, y, targetId, result);
    }

    private static NemesisState.LogEntry readLog(JsonNode node) {
        String type = node.path("type").asText(null);
        String message = node.path("message").asText(null);
        Integer from = node.hasNonNull("from") ? node.get("from").asInt() :
                (node.hasNonNull("fromPlayerId") ? node.get("fromPlayerId").asInt() : null);
        Integer target = node.hasNonNull("target") ? node.get("target").asInt() :
                (node.hasNonNull("targetPlayerId") ? node.get("targetPlayerId").asInt() : null);
        Integer x = node.hasNonNull("x") ? node.get("x").asInt() : null;
        Integer y = node.hasNonNull("y") ? node.get("y").asInt() : null;
        String result = node.path("result").isNull() ? null : node.path("result").asText(null);
        return new NemesisState.LogEntry(type, message, from, target, x, y, result);
    }
}
