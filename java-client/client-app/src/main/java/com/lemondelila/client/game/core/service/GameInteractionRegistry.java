package com.lemondelila.client.game.core.service;

import com.lemondelila.client.game.core.controller.GameInteractionProvider;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public final class GameInteractionRegistry {

    private final Map<String, GameInteractionProvider> providers = new HashMap<>();

    public void register(GameInteractionProvider provider) {
        if (provider == null || provider.gameType() == null) return;
        providers.put(provider.gameType(), provider);
    }

    public Optional<GameInteractionProvider> find(String gameType) {
        if (gameType == null) return Optional.empty();
        return Optional.ofNullable(providers.get(gameType));
    }
}
