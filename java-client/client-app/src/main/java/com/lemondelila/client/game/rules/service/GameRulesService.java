package com.lemondelila.client.game.rules.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.network.RealtimeApiClient;
import com.lemondelila.client.game.rules.model.GameRuleDocument;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Récupère le markdown des règles d'un jeu via /api/games/{id}/rules.
 */
public final class GameRulesService {

    private final RealtimeApiClient apiClient;
    private final Map<String, GameRuleDocument> cache = new ConcurrentHashMap<>();

    public GameRulesService(RealtimeApiClient apiClient) {
        this.apiClient = apiClient;
    }

    public GameRuleDocument load(String gameId) throws IOException, InterruptedException {
        if (gameId == null || gameId.isBlank()) {
            throw new IllegalArgumentException("gameId requis");
        }
        GameRuleDocument cached = cache.get(gameId);
        if (cached != null) {
            return cached;
        }
        JsonNode response = apiClient.request("game.rules", Map.of("gameType", gameId), JsonNode.class);
        String content = response.path("rules").asText("");
        GameRuleDocument doc = new GameRuleDocument(gameId, content, System.currentTimeMillis());
        cache.put(gameId, doc);
        return doc;
    }
}
