package com.lemondelila.client.game.core.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.network.RealtimeApiClient;
import com.lemondelila.client.game.core.model.ActionRequest;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service générique pour envoyer des actions sur une room de jeu.
 */
public final class GameActionService {

    private final RealtimeApiClient apiClient;

    public GameActionService(RealtimeApiClient apiClient) {
        this.apiClient = apiClient;
    }

    /**
     * Envoie une liste d'actions au backend pour un jeu donné.
     */
    public JsonNode sendActions(String gameType, int roomId, List<ActionRequest> actions) throws IOException, InterruptedException {
        List<Map<String, Object>> serialized = actions.stream()
                .map(a -> Map.of(
                        "type", a.type(),
                        "payload", a.payload() == null ? Map.of() : a.payload()
                ))
                .collect(Collectors.toList());
        return apiClient.request(
                "game.actions.apply",
                Map.of("gameType", gameType, "roomId", roomId, "actions", serialized),
                JsonNode.class);
    }

    public JsonNode fetchState(String gameType, int roomId) throws IOException, InterruptedException {
        return apiClient.request(
                "game.state",
                Map.of("gameType", gameType, "roomId", roomId),
                JsonNode.class);
    }
}
