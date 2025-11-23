package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.game.history.service.GameAnnouncer;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.room.service.GameLaunchCoordinator;
import com.lemondelila.client.game.room.service.GameLaunchHandler;
import com.lemondelila.client.game.room.service.RoomRealtimeService;
import com.lemondelila.client.gamelogic.panierexpress.PanierExpressGameModule;

import java.util.Map;
import java.util.Objects;

/**
 * Handler de lancement pour Panier Express, raccorde automatiquement au coordinateur.
 */
public final class PanierExpressGameLaunchHandler implements GameLaunchHandler {

    private final TableState tableState;
    private final GameAnnouncer announcer;
    private final GameHistorySidebar historySidebar;
    private final RoomRealtimeService realtime;

    @Inject
    public PanierExpressGameLaunchHandler(TableState tableState,
                                          GameAnnouncer announcer,
                                          GameHistorySidebar historySidebar,
                                          RoomRealtimeService realtime,
                                          GameLaunchCoordinator coordinator) {
        this.tableState = Objects.requireNonNull(tableState, "tableState");
        this.announcer = Objects.requireNonNull(announcer, "announcer");
        this.historySidebar = Objects.requireNonNull(historySidebar, "historySidebar");
        this.realtime = Objects.requireNonNull(realtime, "realtime");
        Objects.requireNonNull(coordinator, "coordinator").register(this);
    }

    @Override
    public String gameType() {
        return PanierExpressGameModule.GAME_TYPE;
    }

    @Override
    public void launch(int roomId) {
        int participants = tableState.players().size() + tableState.bots().size();
        if (participants < 2) {
            announcer.announce(historySidebar, "Impossible de démarrer : ajoutez un autre joueur ou un bot.");
            return;
        }
        try {
            realtime.sendCommand("room.start", Map.of());
            announcer.announce(historySidebar, "Démarrage de la partie demandé.");
        } catch (Exception ex) {
            announcer.announce(historySidebar, "Démarrage impossible : " + ex.getMessage());
        }
    }
}
