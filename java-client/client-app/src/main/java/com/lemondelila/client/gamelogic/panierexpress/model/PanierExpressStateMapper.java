package com.lemondelila.client.gamelogic.panierexpress.model;

import com.fasterxml.jackson.databind.JsonNode;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public final class PanierExpressStateMapper {

    private PanierExpressStateMapper() {
    }

    public static PanierExpressState fromJson(JsonNode root) throws IOException {
        if (root == null || !root.isObject()) {
            throw new IOException("Etat Panier Express invalide");
        }

        String status = root.path("status").asText("playing");
        String phase = root.path("phase").asText("turn");
        int round = root.path("round").asInt(1);
        int turnIndex = root.path("turnIndex").asInt(0);
        Integer lastRoll = root.hasNonNull("lastRoll") ? root.get("lastRoll").asInt() : null;

        List<PanierExpressState.Player> players = parsePlayers(root.path("players"));
        PanierExpressState.PendingQuiz pending = parsePending(root.path("pending"));
        List<PanierExpressState.LogEntry> log = parseLog(root.path("log"));
        Integer winnerId = root.hasNonNull("winner") ? root.get("winner").asInt() : null;

        return new PanierExpressState(status, phase, round, turnIndex, lastRoll, winnerId, players, pending, log);
    }

    private static List<PanierExpressState.Player> parsePlayers(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<PanierExpressState.Player> players = new ArrayList<>();
        for (JsonNode entry : node) {
            int id = entry.path("id").asInt(-1);
            String username = entry.path("username").asText("Joueur");
            int position = entry.path("position").asInt(1);
            List<String> shopping = parseStringArray(entry.path("shoppingList"));
            List<String> basket = parseStringArray(entry.path("basket"));
            List<String> inventory = parseStringArray(entry.path("inventory"));
            boolean ready = entry.path("readyForCheckout").asBoolean(false);
            int skip = entry.path("skipTurns").asInt(0);
            boolean isBot = entry.path("isBot").asBoolean(false);
            players.add(new PanierExpressState.Player(id, username, position, shopping, basket, inventory, ready, skip, isBot));
        }
        return List.copyOf(players);
    }

    private static List<String> parseStringArray(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<String> values = new ArrayList<>();
        for (JsonNode item : node) {
            if (item.isTextual()) {
                values.add(item.asText());
            }
        }
        return List.copyOf(values);
    }

    private static PanierExpressState.PendingQuiz parsePending(JsonNode node) {
        if (!node.isObject()) {
            return null;
        }
        String type = node.path("type").asText("");
        if (!"quiz".equalsIgnoreCase(type)) {
            return null;
        }
        int playerId = node.path("playerId").asInt(-1);
        String question = node.path("question").asText("");
        List<String> choices = parseStringArray(node.path("choices"));
        return new PanierExpressState.PendingQuiz(playerId, question, choices);
    }

    private static List<PanierExpressState.LogEntry> parseLog(JsonNode node) {
        if (!node.isArray()) {
            return List.of();
        }
        List<PanierExpressState.LogEntry> entries = new ArrayList<>();
        for (JsonNode item : node) {
            String type = item.path("type").asText("info");
            String message = item.path("message").asText("");
            entries.add(new PanierExpressState.LogEntry(type, message));
        }
        return List.copyOf(entries);
    }
}
