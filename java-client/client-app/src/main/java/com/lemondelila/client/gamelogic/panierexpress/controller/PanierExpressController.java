package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSessionStore;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressRemoteClient;
import com.lemondelila.framework.core.di.Inject;
import com.lemondelila.framework.ui.dialog.DialogService;

import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * Façade regroupant les fonctionnalités Panier Express côté client.
 * Le pilotage est délégué à des composants spécialisés afin de faciliter la maintenance.
 */
public final class PanierExpressController {

    private final PanierExpressSessionManager sessionManager;
    private final PanierExpressGameLauncher gameLauncher;
    private final PanierExpressTurnController turnController;

    @Inject
    public PanierExpressController(PanierExpressRemoteClient remoteClient,
                                   PanierExpressSessionStore sessionStore,
                                   DialogService dialogService) {
        this.sessionManager = new PanierExpressSessionManager(sessionStore);
        PanierExpressErrorHandler errorHandler = new PanierExpressErrorHandler(dialogService);
        this.gameLauncher = new PanierExpressGameLauncher(remoteClient, sessionManager, errorHandler);
        this.turnController = new PanierExpressTurnController(remoteClient, sessionManager, errorHandler);
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

    public Optional<PanierExpressSession> currentSession() {
        return sessionManager.current();
    }

    public void addSessionListener(Consumer<PanierExpressSession> listener) {
        sessionManager.addListener(listener);
    }

    public void removeSessionListener(Consumer<PanierExpressSession> listener) {
        sessionManager.removeListener(listener);
    }
}
