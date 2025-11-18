package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSessionStore;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressRemoteClient;
import com.lemondelila.client.game.controller.GameControllerSupport;
import com.lemondelila.client.game.service.GameRoomBotManager;
import com.lemondelila.client.game.service.RoomBotRemoteClient;

import java.util.Collection;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Fa��ade regroupant les fonctionnalit�s Panier Express c�t� client.
 * Le pilotage est d�l�gu� � des composants sp�cialis�s afin de faciliter la maintenance.
 */
public final class PanierExpressController {

    private final GameControllerSupport<PanierExpressSession> support;
    private final PanierExpressGameLauncher gameLauncher;
    private final PanierExpressTurnController turnController;
    private final GameRoomBotManager<PanierExpressSession> botManager;

    @Inject
    public PanierExpressController(PanierExpressRemoteClient remoteClient,
                                   PanierExpressSessionStore sessionStore,
                                   DialogService dialogService,
                                   DomainEventBus eventBus,
                                   RoomBotRemoteClient roomBots) {
        this.support = new GameControllerSupport<>(sessionStore, eventBus, dialogService, "Panier Express");
        this.gameLauncher = new PanierExpressGameLauncher(remoteClient, support.tracker(), support.errors());
        this.turnController = new PanierExpressTurnController(remoteClient, support.tracker(), support.errors());
        this.botManager = new GameRoomBotManager<>(
                Objects.requireNonNull(roomBots, "roomBots"),
                support.errors(),
                support::currentSession,
                this::refreshGame,
                this::resolveBotNames,
                new GameRoomBotManager.Messages(
                        "Aucune partie active",
                        "Impossible d'ajouter un bot",
                        "Impossible de recuperer la liste des bots",
                        "Impossible de retirer le bot",
                        "Aucun bot disponible"
                ));
    }

    public CompletableFuture<PanierExpressSession> startGame(boolean forceNew) {
        return gameLauncher.startGame(forceNew, gameLauncher.lastOptions());
    }

    public CompletableFuture<PanierExpressSession> startGame(boolean forceNew,
                                                             PanierExpressGameOptions options) {
        return gameLauncher.startGame(forceNew, options);
    }

    public CompletableFuture<PanierExpressSession> refreshGame() {
        return turnController.refreshGame();
    }

    public CompletableFuture<PanierExpressSession> roll() {
        return turnController.roll();
    }

    public CompletableFuture<PanierExpressSession> answerQuiz(int choice) {
        return turnController.answerQuiz(choice);
    }

    public CompletableFuture<PanierExpressSession> addBot() {
        return botManager.addBot();
    }

    public CompletableFuture<PanierExpressSession> removeBot() {
        return botManager.removeBot();
    }

    public java.util.Optional<PanierExpressSession> currentSession() {
        return support.currentSession();
    }

    public void addSessionListener(Consumer<PanierExpressSession> listener) {
        support.addListener(listener);
    }

    public void removeSessionListener(Consumer<PanierExpressSession> listener) {
        support.removeListener(listener);
    }

    public void reset() {
        support.clearSessions();
        gameLauncher.reset();
    }

    private Collection<String> resolveBotNames(PanierExpressSession session) {
        if (session.state() == null || session.state().players() == null) {
            return java.util.List.of();
        }
        return session.state().players().stream()
                .filter(player -> player != null && player.isBot())
                .map(player -> player.username())
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
    }
}

