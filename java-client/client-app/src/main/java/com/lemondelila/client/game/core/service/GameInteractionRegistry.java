package com.lemondelila.client.game.core.service;

import com.lemondelila.client.game.core.controller.GameInteractionProvider;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public final class GameInteractionRegistry {

    private final Map<String, GameInteractionProvider> providers = new HashMap<>();
    private GameInteractionProvider defaultProvider;

    public void register(GameInteractionProvider provider) {
        if (provider == null || provider.gameType() == null) return;
        String key = provider.gameType().trim();
        if ("*".equals(key)) {
            defaultProvider = provider;
            return;
        }
        providers.put(key, provider);
    }

    public Optional<GameInteractionProvider> find(String gameType) {
        if (gameType == null) return Optional.empty();
        GameInteractionProvider provider = providers.get(gameType);
        if (provider == null) {
            provider = defaultProvider;
        }
        return Optional.ofNullable(provider);
    }
}
