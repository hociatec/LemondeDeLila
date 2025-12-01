package com.lemondelila.client.game.core.service;

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
        JsonNode pendingExchangeNode = json.path("exchangePending");
        if (!pendingExchangeNode.isObject()) {
            pendingExchangeNode = null;
        }

        Map<String, Object> extras = new HashMap<>();
        if (json.has("players")) {
            extras.put("players", json.get("players"));
        }
        if (json.has("board")) {
            extras.put("board", json.get("board"));
        }
        if (json.has("turn")) {
            extras.put("turn", json.get("turn"));
        }
        if (json.has("deck")) {
            extras.put("deck", json.get("deck"));
        }
        if (json.has("metadata")) {
            extras.put("metadata", json.get("metadata"));
        }
        if (json.has("catalog")) {
            extras.put("catalog", json.get("catalog"));
        }
        if (json.has("pollution")) {
            extras.put("pollution", json.get("pollution"));
        }
        if (pendingExchangeNode != null) {
            extras.put("pendingExchange", pendingExchangeNode);
        }

        return new GenericGameState(status, phase, round, turnIndex, lastRoll, logs, pending, extras);
    }
}
