package com.lemondelila.client.game.core.mapper;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.core.model.GenericGameState;

import java.util.ArrayList;
import java.util.List;
import java.util.HashMap;
import java.util.Map;

public final class GenericGameStateMapper {

    public GenericGameState map(JsonNode json) {
        if (json == null || json.isMissingNode()) {
            return GenericGameState.empty();
        }
        String status = json.path("status").asText("");
        String phase = json.path("phase").asText("");
        int round = json.path("round").asInt(1);
        int turnIndex = json.path("turnIndex").asInt(0);
        Integer lastRoll = json.has("lastRoll") && !json.get("lastRoll").isNull()
                ? json.get("lastRoll").asInt()
                : null;

        List<String> logs = new ArrayList<>();
        JsonNode logNode = json.path("log");
        if (logNode.isArray()) {
            logNode.forEach(node -> {
                String msg = node.path("message").asText("");
                if (!msg.isBlank()) {
                    logs.add(msg);
                }
            });
        }

        GenericGameState.PendingQuiz pending = null;
        JsonNode pendingNode = json.path("pending");
        if (pendingNode.isObject() && "quiz".equalsIgnoreCase(pendingNode.path("type").asText())) {
            List<String> choices = new ArrayList<>();
            if (pendingNode.has("choices") && pendingNode.get("choices").isArray()) {
                pendingNode.get("choices").forEach(c -> choices.add(c.asText("")));
            }
            pending = new GenericGameState.PendingQuiz(
                    pendingNode.path("question").asText(""),
                    choices,
                    pendingNode.path("playerId").isInt() ? pendingNode.get("playerId").asInt() : null
            );
        }

        Map<String, Object> extras = new HashMap<>();
        // Stocke l'ère JSON brute si nécessaire pour d'autres jeux (ex: players, board...) -> facultatif.
        if (json.has("players")) {
            extras.put("players", json.get("players"));
        }
        if (json.has("board")) {
            extras.put("board", json.get("board"));
        }
        if (json.has("turn")) {
            extras.put("turn", json.get("turn"));
        }

        return new GenericGameState(status, phase, round, turnIndex, lastRoll, logs, pending, extras);
    }
}
