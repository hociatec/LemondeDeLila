package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.game.core.GameTableLauncher;

public final class PanierExpressTableController {

    public static final String GAME_TYPE = "panier-express";

    private final GameTableLauncher tableLauncher;
    private final DomainEventBus eventBus;

    @Inject
    public PanierExpressTableController(GameTableLauncher tableLauncher,
                                        DomainEventBus eventBus) {
        this.tableLauncher = tableLauncher;
        this.eventBus = eventBus;
    }

    public void createDefaultTable() {
        createTable("Table Panier Express", 6, true);
    }

    public void createTable(String name, int maxPlayers, boolean isPrivate) {
        tableLauncher.createTemporaryTable(GAME_TYPE, name, maxPlayers, isPrivate);
    }

    public void join(int roomId) {
        eventBus.publish(new com.lemondelila.client.game.room.event.JoinRoomRequested(roomId));
    }

    public void leave(int roomId) {
        eventBus.publish(new com.lemondelila.client.game.room.event.LeaveRoomRequested(roomId));
    }

    public void start(int roomId) {
        eventBus.publish(new com.lemondelila.client.game.room.event.StartRoomRequested(roomId));
    }
}
