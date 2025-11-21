package com.lemondelila.client.game.core;

import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.di.Inject;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Catalogue des providers d'interaction (par type de jeu).
 */
public final class GameInteractionRegistry {

    private final List<GameInteractionProvider> providers;

    @Inject
    public GameInteractionRegistry(ApplicationContext context) {
        this.providers = List.copyOf(context.getAll(GameInteractionProvider.class));
    }

    public Optional<GameInteractionProvider> find(String gameType) {
        if (gameType == null) {
            return Optional.empty();
        }
        return providers.stream()
                .filter(p -> gameType.equalsIgnoreCase(p.gameType()))
                .findFirst();
    }

    public List<GameInteractionProvider> providers() {
        return providers;
    }
}
