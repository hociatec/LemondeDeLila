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
import com.lemondelila.client.game.core.GameTableLauncher;
import com.lemondelila.client.game.core.GameAnnouncer;
import com.lemondelila.client.game.room.model.RoomState;
import com.lemondelila.client.game.room.service.RoomApiService;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.view.RoomTableScreen;

public final class GameCatalogController implements AutoCloseable {

    private final GameCatalogService service;
    private final DomainEventBus eventBus;
    private final TaskScheduler scheduler;
    private final EventSubscriptions subscriptions = new EventSubscriptions();
    private final GameTableLauncher tableLauncher;
    private final GameAnnouncer announcer;
    private final RoomApiService roomApi;
    private final RoomDetailsState roomDetailsState;

    @Inject
    public GameCatalogController(GameCatalogService service,
                                 DomainEventBus eventBus,
                                 TaskScheduler scheduler,
                                 GameTableLauncher tableLauncher,
                                 GameAnnouncer announcer,
                                 RoomApiService roomApi,
                                 RoomDetailsState roomDetailsState) {
        this.service = service;
        this.eventBus = eventBus;
        this.scheduler = scheduler;
        this.tableLauncher = tableLauncher;
        this.announcer = announcer;
        this.roomApi = roomApi;
        this.roomDetailsState = roomDetailsState;
        subscriptions.subscribe(eventBus, CatalogRequested.class, ev -> fetchAll());
    }

    public ControllerResult openCatalog() {
        fetchAll();
        return ControllerResult.navigate(com.lemondelila.client.game.catalog.view.GameCatalogScreen.ID)
                .withStatus("Catalogue en cours de chargement");
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
            RoomState room = roomApi.createRoom(name, gameCode, maxPlayers, isPrivate);
            tableLauncher.createTemporaryTable(gameCode, name, maxPlayers, isPrivate);
            String msg = String.format("Table \"%s\" (jeu %s) créée (id=%s), max %d joueurs, privée=%s.",
                    name, gameCode, room != null ? room.id() : "?", maxPlayers, isPrivate ? "oui" : "non");
            announcer.announce(msg);
            if (room != null && room.id() != null) {
                roomDetailsState.setRoomId(room.id());
                roomDetailsState.setGameType(gameCode);
                return ControllerResult.navigate(RoomTableScreen.ID).withStatus(msg);
            }
            return ControllerResult.status(msg);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            String err = "Création de table interrompue";
            announcer.announce(err);
            return ControllerResult.status(err);
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
