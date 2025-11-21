package com.lemondelila.client.gamelogic.panierexpress.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressLogEntry;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public final class PanierExpressApiService {

    private final RestClient restClient;

    public PanierExpressApiService(RestClient restClient) {
        this.restClient = restClient;
    }

    public PanierExpressState fetchState(int roomId) throws IOException, InterruptedException {
        JsonNode json = restClient.get("games/panier-express/rooms/" + roomId + "/state");
        return mapState(json);
    }

    public PanierExpressState sendActions(int roomId, List<ActionRequest> actions) throws IOException, InterruptedException {
        List<Map<String, Object>> serialized = actions.stream()
                .map(a -> {
                    Map<String, Object> payload = a.payload() == null ? Map.of() : a.payload();
                    Map<String, Object> map = new HashMap<>();
                    map.put("type", a.type());
                    map.put("payload", payload);
                    return map;
                })
                .collect(Collectors.toList());
        JsonNode json = restClient.post("games/panier-express/rooms/" + roomId + "/actions", Map.of(
                "actions", serialized
        ));
        return mapState(json);
    }

    private PanierExpressState mapState(JsonNode json) {
        if (json == null || json.isMissingNode()) {
            return PanierExpressState.empty();
        }
        String status = json.path("status").asText("");
        String phase = json.path("phase").asText("");
        int round = json.path("round").asInt(1);
        int turnIndex = json.path("turnIndex").asInt(0);
        Integer lastRoll = json.has("lastRoll") && !json.get("lastRoll").isNull()
                ? json.get("lastRoll").asInt()
                : null;

        var players = new ArrayList<String>();
        if (json.has("players") && json.get("players").isArray()) {
            json.get("players").forEach(node -> players.add(node.path("username").asText("Joueur")));
        }

        var logs = new ArrayList<PanierExpressLogEntry>();
        if (json.has("log") && json.get("log").isArray()) {
            json.get("log").forEach(node -> logs.add(new PanierExpressLogEntry(
                    node.path("type").asText("info"),
                    node.path("message").asText("")
            )));
        }

        PanierExpressState.PendingQuiz pending = null;
        JsonNode pendingNode = json.path("pending");
        if (pendingNode.isObject() && "quiz".equalsIgnoreCase(pendingNode.path("type").asText())) {
            List<String> choices = new ArrayList<>();
            if (pendingNode.has("choices") && pendingNode.get("choices").isArray()) {
                pendingNode.get("choices").forEach(c -> choices.add(c.asText("")));
            }
            pending = new PanierExpressState.PendingQuiz(
                    pendingNode.path("question").asText(""),
                    choices,
                    pendingNode.path("playerId").isInt() ? pendingNode.get("playerId").asInt() : null
            );
        }

        return new PanierExpressState(status, phase, round, turnIndex, lastRoll, players, logs, pending);
    }
}
