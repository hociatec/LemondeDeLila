package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressRemoteClient;
import com.lemondelila.client.game.model.DialogGameErrorHandler;
import com.lemondelila.client.game.model.GameSessionTracker;

import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Pilotage du lancement et de la relance des parties Panier Express.
 */
final class PanierExpressGameLauncher {

    private final PanierExpressRemoteClient remoteClient;
    private final GameSessionTracker<PanierExpressSession> sessionTracker;
    private final DialogGameErrorHandler errorHandler;

    private final AtomicBoolean loading = new AtomicBoolean(false);
    private volatile PanierExpressGameOptions lastOptions = PanierExpressGameOptions.defaults();

    PanierExpressGameLauncher(PanierExpressRemoteClient remoteClient,
                              GameSessionTracker<PanierExpressSession> sessionTracker,
                              DialogGameErrorHandler errorHandler) {
        this.remoteClient = Objects.requireNonNull(remoteClient, "remoteClient");
        this.sessionTracker = Objects.requireNonNull(sessionTracker, "sessionTracker");
        this.errorHandler = Objects.requireNonNull(errorHandler, "errorHandler");
    }

    CompletableFuture<PanierExpressSession> startGame(boolean forceNew,
                                                      PanierExpressGameOptions options) {
        if (loading.get()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Initialisation en cours"));
        }
        PanierExpressGameOptions effective = options == null
                ? PanierExpressGameOptions.defaults()
                : PanierExpressGameOptions.of(options.robotCount());

        lastOptions = effective;
        Optional<PanierExpressSession> existing = sessionTracker.current();
        if (!forceNew && existing.isPresent()) {
            return CompletableFuture.completedFuture(existing.get());
        }

        if (forceNew) {
            sessionTracker.clearAll();
        }

        loading.set(true);
        CompletableFuture<PanierExpressSession> future = remoteClient.startNewGame(effective);
        future.whenComplete((session, error) -> {
            loading.set(false);
            if (error != null) {
                errorHandler.show("Impossible d'initialiser la partie Panier Express", error);
                return;
            }
            if (session != null) {
                sessionTracker.save(session);
            }
        });
        return future;
    }

    PanierExpressGameOptions lastOptions() {
        return lastOptions;
    }

    void reset() {
        loading.set(false);
        lastOptions = PanierExpressGameOptions.defaults();
    }
}
