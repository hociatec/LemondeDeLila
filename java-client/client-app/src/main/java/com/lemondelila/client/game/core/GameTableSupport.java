package com.lemondelila.client.game.core;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.game.room.event.CreateRoomRequested;
import com.lemondelila.client.game.room.event.JoinRoomRequested;
import com.lemondelila.client.game.room.event.LeaveRoomRequested;
import com.lemondelila.client.game.room.event.StartRoomRequested;

/**
 * Support commun pour les jeux : publie sur le bus les actions génériques table/room
 * (créer, rejoindre, quitter, démarrer) en attachant le gameType approprié.
 */
public abstract class GameTableSupport {

    private final DomainEventBus eventBus;
    private final String gameType;

    protected GameTableSupport(DomainEventBus eventBus, String gameType) {
        this.eventBus = eventBus;
        this.gameType = gameType;
    }

    protected void createTable(String name, int maxPlayers, boolean isPrivate) {
        eventBus.publish(new CreateRoomRequested(name, gameType, maxPlayers, isPrivate));
    }

    protected void joinTable(int roomId) {
        eventBus.publish(new JoinRoomRequested(roomId));
    }

    protected void leaveTable(int roomId) {
        eventBus.publish(new LeaveRoomRequested(roomId));
    }

    protected void startTable(int roomId) {
        eventBus.publish(new StartRoomRequested(roomId));
    }

    public String gameType() {
        return gameType;
    }
}
