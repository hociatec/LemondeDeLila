package com.lemondelila.client.gamelogic.missionnemesis.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.game.model.DialogGameErrorHandler;
import com.lemondelila.client.game.service.RoomBotRemoteClient;
import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;
import com.lemondelila.client.gamelogic.missionnemesis.service.NemesisRemoteClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public final class NemesisController {

    private static final Logger LOGGER = LoggerFactory.getLogger(NemesisController.class);
    private static final String GAME_TYPE = "mission-nemesis";

    private final DialogGameErrorHandler errorHandler;
    private final NemesisSessionCoordinator sessionCoordinator;
    private final NemesisGameActions gameActions;
    private final NemesisBotActions botActions;

    @Inject
    public NemesisController(NemesisRemoteClient remoteClient,
                             RoomBotRemoteClient roomBots,
                             NemesisSessionStore sessionStore,
                             RealtimeGateway realtimeGateway,
                             DialogService dialogService,
                             DomainEventBus eventBus) {
        Objects.requireNonNull(remoteClient, "remoteClient");
        Objects.requireNonNull(roomBots, "roomBots");
        Objects.requireNonNull(sessionStore, "sessionStore");
        Objects.requireNonNull(realtimeGateway, "realtimeGateway");
        Objects.requireNonNull(dialogService, "dialogService");
        Objects.requireNonNull(eventBus, "eventBus");

        this.errorHandler = new DialogGameErrorHandler(dialogService, "Mission Nemesis");
        this.sessionCoordinator = new NemesisSessionCoordinator(sessionStore, eventBus, realtimeGateway);
        this.gameActions = new NemesisGameActions(remoteClient, errorHandler, sessionCoordinator);
        this.botActions = new NemesisBotActions(roomBots, errorHandler, sessionCoordinator, this.gameActions::refresh);
        new NemesisRealtimeHandler(realtimeGateway, remoteClient, sessionCoordinator, GAME_TYPE, LOGGER);
    }

    public CompletableFuture<NemesisSession> startNewGame() {
        return gameActions.startNewGame();
    }

    public CompletableFuture<NemesisSession> refresh() {
        return gameActions.refresh();
    }

    public CompletableFuture<NemesisSession> placeFleet(List<ShipPlacement> placements) {
        return gameActions.placeFleet(placements);
    }

    public CompletableFuture<NemesisSession> fire(GridCoordinate coordinate) {
        return gameActions.fire(coordinate);
    }

    public CompletableFuture<NemesisSession> addBot() {
        return botActions.addBot();
    }

    public CompletableFuture<NemesisSession> removeBot() {
        return botActions.removeBot();
    }

    public void addListener(Consumer<NemesisSession> listener) {
        sessionCoordinator.addListener(listener);
    }

    public void removeListener(Consumer<NemesisSession> listener) {
        sessionCoordinator.removeListener(listener);
    }

    public Optional<NemesisSession> currentSession() {
        return sessionCoordinator.currentSession();
    }

    public void reset() {
        sessionCoordinator.reset();
    }

    static <T> CompletableFuture<T> failedFuture(Throwable error) {
        CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }

    static RuntimeException propagate(Throwable error) {
        if (error instanceof RuntimeException runtime) {
            return runtime;
        }
        return new RuntimeException(error);
    }
}
