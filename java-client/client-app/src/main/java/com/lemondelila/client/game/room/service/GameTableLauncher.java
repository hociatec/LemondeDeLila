package com.lemondelila.client.game.room.service;

import com.lemondelila.client.framework.core.event.DomainEventBus;

/**
 * Service centralisé pour déclencher la création de tables/rooms génériques.
 */
public final class GameTableLauncher {

    private final DomainEventBus eventBus;

    public GameTableLauncher(DomainEventBus eventBus) {
        this.eventBus = eventBus;
    }

    public void createTable(String gameType) {
        createTemporaryTable(gameType, null, 0, true);
    }

    public void createTemporaryTable(String gameType, String name, int maxPlayers, boolean isPrivate) {
        String safeGame = (gameType == null || gameType.isBlank()) ? "panier-express" : gameType;
        String safeName = (name == null || name.isBlank()) ? safeGame : name;
        int safeMax = maxPlayers <= 0 ? 4 : maxPlayers;
        eventBus.publish(new com.lemondelila.client.game.room.event.CreateRoomRequested(safeName, safeGame, safeMax, isPrivate));
    }
}
