package com.lemondelila.client.game.rules.service;

import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.game.rules.model.GameRuleDocument;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Récupère le markdown des règles d'un jeu via /api/games/{id}/rules.
 */
public final class GameRulesService {

    private final RestClient restClient;
    private final Map<String, GameRuleDocument> cache = new ConcurrentHashMap<>();

    public GameRulesService(RestClient restClient) {
        this.restClient = restClient;
    }

    public GameRuleDocument load(String gameId) throws IOException, InterruptedException {
        if (gameId == null || gameId.isBlank()) {
            throw new IllegalArgumentException("gameId requis");
        }
        GameRuleDocument cached = cache.get(gameId);
        if (cached != null) {
            return cached;
        }
        // Le backend renvoie du text/plain
        byte[] bytes = restClient.getRawBytes("games/" + gameId + "/rules");
        String content = new String(bytes, StandardCharsets.UTF_8);
        GameRuleDocument doc = new GameRuleDocument(gameId, content, System.currentTimeMillis());
        cache.put(gameId, doc);
        return doc;
    }
}
