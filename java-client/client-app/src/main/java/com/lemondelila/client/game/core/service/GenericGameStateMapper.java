package com.lemondelila.client.game.core.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.contract.ContractAction;
import com.lemondelila.client.game.core.contract.ContractActionLogEntry;
import com.lemondelila.client.game.core.contract.ContractGameState;
import com.lemondelila.client.game.core.contract.ContractPending;
import com.lemondelila.client.game.turn.model.TurnState;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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
        boolean botThinking = json.path("botThinking").asBoolean(false);

        TurnState turn = mapTurn(json.path("turn"), round);

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

        GenericGameState.Pending pending = null;
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
        } else if (pendingNode.isObject()) {
            String pendingType = pendingNode.path("type").asText("");
            String name = pendingNode.path("name").asText("");
            Integer playerId = pendingNode.path("playerId").isInt() ? pendingNode.get("playerId").asInt() : null;
            Integer targetPlayerId = pendingNode.path("targetPlayerId").isInt() ? pendingNode.get("targetPlayerId").asInt() : null;
            pending = new GenericGameState.PendingGeneric(
                    pendingType,
                    name,
                    playerId,
                    targetPlayerId,
                    pendingNode
            );
        }
        JsonNode pendingExchangeNode = null;

        List<GenericGameState.GenericAction> actions = new ArrayList<>();
        JsonNode actionsNode = json.path("actions");
        if (actionsNode.isArray()) {
            actionsNode.forEach(node -> {
                String type = node.path("type").asText("");
                String label = node.path("label").asText("");
                JsonNode payload = node.path("payload");
                actions.add(new GenericGameState.GenericAction(type, label, payload.isMissingNode() ? null : payload));
            });
        }

        JsonNode players = json.has("players") && json.get("players").isArray() ? json.get("players") : null;
        JsonNode board = json.has("board") && json.get("board").isObject() ? json.get("board") : null;
        JsonNode metadata = json.has("metadata") && json.get("metadata").isObject() ? json.get("metadata") : null;
        JsonNode extras = json.has("extras") && json.get("extras").isObject() ? json.get("extras") : null;
        // turn est mappé sur un champ typé (TurnState) ; on ne le duplique plus dans extras.
        List<GenericGameState.ActionLogEntry> actionLog = new ArrayList<>();
        if (metadata != null) {
            JsonNode actionLogNode = metadata.path("actionLog");
            if (actionLogNode.isArray()) {
                actionLogNode.forEach(entry -> {
                    Integer actorId = entry.path("actorId").isInt() ? entry.get("actorId").asInt() : null;
                    String type = entry.path("type").asText("");
                    JsonNode payload = entry.path("payload");
                    Long ts = entry.path("timestamp").isLong() ? entry.get("timestamp").asLong() : null;
                    String step = entry.path("step").asText("");
                    actionLog.add(new GenericGameState.ActionLogEntry(actorId, type, payload.isMissingNode() ? null : payload, ts, step));
                });
            }
        }
        return new GenericGameState(status, phase, round, turnIndex, lastRoll, logs, turn, botThinking, players, board, metadata, extras, actions, actionLog, pending);
    }

    private TurnState mapTurn(JsonNode turnNode, int roundFallback) {
        if (turnNode == null || !turnNode.isObject()) {
            return null;
        }
        int round = turnNode.path("round").asInt(roundFallback > 0 ? roundFallback : 1);
        int index = turnNode.path("index").asInt(-1);
        int direction = turnNode.path("direction").asInt(1);
        Integer currentPlayerId = turnNode.has("currentPlayerId") && turnNode.get("currentPlayerId").isInt()
                ? turnNode.get("currentPlayerId").asInt()
                : null;
        String label = turnNode.has("label") && turnNode.get("label").isTextual() ? turnNode.get("label").asText() : null;
        return new TurnState(round, index, direction, currentPlayerId, label);
    }

    /**
     * Mapping aligné avec `backend/CONTRACT.md` (DTO contractuels), sans impacter l'ancien modèle UI.
     */
    public ContractGameState mapContract(JsonNode json) {
        if (json == null || json.isMissingNode()) {
            return ContractGameState.empty();
        }

        String status = json.path("status").asText("");
        String phase = json.path("phase").asText("");
        int round = json.path("round").asInt(1);
        int turnIndex = json.path("turnIndex").asInt(0);
        Integer lastRoll = json.has("lastRoll") && !json.get("lastRoll").isNull()
                ? json.get("lastRoll").asInt()
                : null;
        boolean botThinking = json.path("botThinking").asBoolean(false);

        TurnState turn = mapTurn(json.path("turn"), round);

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

        List<ContractAction> actions = new ArrayList<>();
        JsonNode actionsNode = json.path("actions");
        if (actionsNode.isArray()) {
            actionsNode.forEach(node -> {
                String type = node.path("type").asText("");
                String label = node.path("label").asText("");
                JsonNode payload = node.path("payload");
                actions.add(new ContractAction(type, label, payload.isMissingNode() ? null : payload));
            });
        }

        ContractPending pending = null;
        JsonNode pendingNode = json.path("pending");
        if (pendingNode.isObject() && "quiz".equalsIgnoreCase(pendingNode.path("type").asText())) {
            List<String> choices = new ArrayList<>();
            if (pendingNode.has("choices") && pendingNode.get("choices").isArray()) {
                pendingNode.get("choices").forEach(c -> choices.add(c.asText("")));
            }
            pending = new ContractPending.Quiz(
                    pendingNode.path("question").asText(""),
                    choices,
                    pendingNode.path("playerId").isInt() ? pendingNode.get("playerId").asInt() : null
            );
        } else if (pendingNode.isObject()) {
            pending = new ContractPending.Generic(
                    pendingNode.path("type").asText(""),
                    pendingNode.path("name").asText(""),
                    pendingNode.path("playerId").isInt() ? pendingNode.get("playerId").asInt() : null,
                    pendingNode.path("targetPlayerId").isInt() ? pendingNode.get("targetPlayerId").asInt() : null,
                    pendingNode
            );
        }

        List<ContractActionLogEntry> actionLog = new ArrayList<>();
        JsonNode metadata = json.path("metadata");
        if (metadata.isObject()) {
            JsonNode actionLogNode = metadata.path("actionLog");
            if (actionLogNode.isArray()) {
                actionLogNode.forEach(entry -> {
                    Integer actorId = entry.path("actorId").isInt() ? entry.get("actorId").asInt() : null;
                    String type = entry.path("type").asText("");
                    JsonNode payload = entry.path("payload");
                    Long ts = entry.path("timestamp").isLong() ? entry.get("timestamp").asLong() : null;
                    String step = entry.path("step").asText("");
                    actionLog.add(new ContractActionLogEntry(actorId, type, payload.isMissingNode() ? null : payload, ts, step));
                });
            }
        }

        Map<String, Object> extras = new HashMap<>();
        if (json.has("players")) extras.put("players", json.get("players"));
        if (json.has("turn")) extras.put("turn", json.get("turn"));
        if (json.has("board")) extras.put("board", json.get("board"));
        if (json.has("catalog")) extras.put("catalog", json.get("catalog"));
        if (json.has("metadata")) extras.put("metadata", json.get("metadata"));
        if (json.has("extras") && json.get("extras").isObject()) {
            json.get("extras").fields().forEachRemaining(entry -> extras.putIfAbsent(entry.getKey(), entry.getValue()));
        }

        return new ContractGameState(status, phase, round, turnIndex, lastRoll, logs, botThinking, actions, pending, actionLog, extras);
    }
}
