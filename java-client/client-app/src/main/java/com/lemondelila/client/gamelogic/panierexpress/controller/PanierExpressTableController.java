package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.game.core.GameTableSupport;

/**
 * Contrôleur léger pour Panier Express qui s'appuie sur les routes génériques /api/rooms.
 */
public final class PanierExpressTableController extends GameTableSupport {

    public static final String GAME_TYPE = "panier-express";

    @Inject
    public PanierExpressTableController(DomainEventBus eventBus) {
        super(eventBus, GAME_TYPE);
    }

    public void createDefaultTable() {
        createTable("Table Panier Express", 6, true);
    }

    public void createTable(String name, int maxPlayers, boolean isPrivate) {
        super.createTable(name, maxPlayers, isPrivate);
    }

    public void join(int roomId) {
        joinTable(roomId);
    }

    public void leave(int roomId) {
        leaveTable(roomId);
    }

    public void start(int roomId) {
        startTable(roomId);
    }
}
