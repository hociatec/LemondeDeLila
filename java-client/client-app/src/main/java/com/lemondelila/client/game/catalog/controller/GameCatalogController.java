package com.lemondelila.client.game.catalog.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.game.catalog.event.CatalogFailed;
import com.lemondelila.client.game.catalog.event.CatalogLoaded;
import com.lemondelila.client.game.catalog.event.CatalogRequested;
import com.lemondelila.client.game.catalog.model.CatalogPayload;
import com.lemondelila.client.game.catalog.service.GameCatalogService;
import com.lemondelila.client.game.room.service.GameTableLauncher;
import com.lemondelila.client.game.history.service.GameAnnouncer;
import com.lemondelila.client.game.room.event.RoomCreated;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.RoomState;
import com.lemondelila.client.game.room.service.RoomRealtimeService;
import com.lemondelila.client.game.room.view.RoomTableScreen;

import java.util.Map;

public final class GameCatalogController implements AutoCloseable {

    private final GameCatalogService service;
    private final DomainEventBus eventBus;
    private final TaskScheduler scheduler;
    private final EventSubscriptions subscriptions = new EventSubscriptions();
    private final GameTableLauncher tableLauncher;
    private final GameAnnouncer announcer;
    private final RoomRealtimeService realtime;
    private final RoomDetailsState roomDetailsState;

    @Inject
    public GameCatalogController(GameCatalogService service,
                                 DomainEventBus eventBus,
                                 TaskScheduler scheduler,
                                 GameTableLauncher tableLauncher,
                                 GameAnnouncer announcer,
                                 RoomRealtimeService realtime,
                                 RoomDetailsState roomDetailsState) {
        this.service = service;
        this.eventBus = eventBus;
        this.scheduler = scheduler;
        this.tableLauncher = tableLauncher;
        this.announcer = announcer;
        this.realtime = realtime;
        this.roomDetailsState = roomDetailsState;
        subscriptions.subscribe(eventBus, CatalogRequested.class, ev -> fetchAll());
        subscriptions.subscribe(eventBus, RoomCreated.class, this::onRoomCreated);
    }

    private void onRoomCreated(RoomCreated event) {
        RoomState room = event.room();
        if (room == null || room.id() == null) {
            return;
        }
        roomDetailsState.setRoomId(room.id());
        roomDetailsState.setGameType(room.gameType());
        roomDetailsState.setRoomName(room.name());
    }

    public ControllerResult openCatalog() {
        return ControllerResult.navigate(com.lemondelila.client.game.catalog.view.GameCatalogScreen.ID);
    }

    public void fetchAll() {
        scheduler.runAsync(() -> {
            try {
                CatalogPayload payload = service.fetchAll();
                eventBus.publish(new CatalogLoaded(payload));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                eventBus.publish(new CatalogFailed(clean(e.getMessage())));
            }
        });
    }

    @Override
    public void close() {
        subscriptions.close();
    }

    /**
     * Crée une table côté backend et journalise l'action.
     */
    public ControllerResult createTableForGame(String gameCode, String name, int maxPlayers, boolean isPrivate) {
        try {
            if (gameCode == null || gameCode.isBlank()) {
                String err = "Création de table impossible : code de jeu manquant";
                announcer.announce(err);
                return ControllerResult.status(err);
            }
            Map<String, Object> payload = Map.of(
                    "gameType", gameCode,
                    "name", name,
                    "maxPlayers", maxPlayers,
                    "isPrivate", isPrivate
            );
            realtime.sendCommand("room.create", payload);
            tableLauncher.createTemporaryTable(gameCode, name, maxPlayers, isPrivate);
            roomDetailsState.setGameType(gameCode);
            roomDetailsState.setRoomName(name);
            return ControllerResult.navigate(RoomTableScreen.ID);
        } catch (Exception e) {
            String err = "Création de table impossible : " + clean(e.getMessage());
            announcer.announce(err);
            return ControllerResult.status(err);
        }
    }

    private static String clean(String message) {
        if (message == null) return "erreur";
        return message.replaceAll("\\s+", " ").trim();
    }
}
