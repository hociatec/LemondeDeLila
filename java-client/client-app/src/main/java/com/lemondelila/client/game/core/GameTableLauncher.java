package com.lemondelila.client.game.core;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.game.room.event.CreateRoomRequested;

/**
 * Service centralisé pour déclencher la création de tables/rooms génériques.
 */
public final class GameTableLauncher {

    private final DomainEventBus eventBus;

    public GameTableLauncher(DomainEventBus eventBus) {
        this.eventBus = eventBus;
    }

    public void createTemporaryTable(String gameCode, String name, int maxPlayers, boolean isPrivate) {
        String tableName = (name == null || name.isBlank()) ? "Table " + gameCode : name;
        int max = maxPlayers > 0 ? maxPlayers : 4;
        eventBus.publish(new CreateRoomRequested(
                tableName,
                gameCode,
                max,
                isPrivate
        ));
    }
}
