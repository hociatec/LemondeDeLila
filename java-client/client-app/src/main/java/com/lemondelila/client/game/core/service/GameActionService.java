package com.lemondelila.client.game.core.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.game.core.model.ActionRequest;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Service générique pour envoyer des actions sur une room de jeu.
 */
public final class GameActionService {

    private final RestClient restClient;

    public GameActionService(RestClient restClient) {
        this.restClient = restClient;
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
        return restClient.post("games/" + gameType + "/rooms/" + roomId + "/actions", Map.of("actions", serialized));
    }

    public JsonNode fetchState(String gameType, int roomId) throws IOException, InterruptedException {
        return restClient.get("games/" + gameType + "/rooms/" + roomId + "/state");
    }
}
