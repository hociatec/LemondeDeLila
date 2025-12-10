package com.lemondelila.client.game.room.service;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import java.util.Objects;

/**
 * Service centralisé pour déclencher la création de tables/rooms génériques.
 */
public final class GameTableLauncher {

    private final DomainEventBus eventBus;

    public GameTableLauncher(DomainEventBus eventBus) {
        this.eventBus = eventBus;
    }

    public void createTable(String gameType) {
        createTemporaryTable(gameType, null, 0, false);
    }

    public void createTemporaryTable(String gameType, String name, int maxPlayers, boolean isPrivate) {
        String safeGame = Objects.requireNonNull(gameType, "gameType").trim();
        if (safeGame.isEmpty()) {
            throw new IllegalArgumentException("gameType must not be blank");
        }
        String safeName = (name == null || name.isBlank()) ? safeGame : name;
        int safeMax = maxPlayers <= 0 ? 4 : maxPlayers;
        eventBus.publish(new com.lemondelila.client.game.room.event.CreateRoomRequested(safeName, safeGame, safeMax, isPrivate));
    }
}
