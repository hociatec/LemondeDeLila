package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressRemoteClient;

import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Pilotage du lancement et de la relance des parties Panier Express.
 */
final class PanierExpressGameLauncher {

    private final PanierExpressRemoteClient remoteClient;
    private final PanierExpressSessionManager sessionManager;
    private final PanierExpressErrorHandler errorHandler;

    private final AtomicBoolean loading = new AtomicBoolean(false);
    private volatile PanierExpressGameOptions lastOptions = PanierExpressGameOptions.defaults();

    PanierExpressGameLauncher(PanierExpressRemoteClient remoteClient,
                              PanierExpressSessionManager sessionManager,
                              PanierExpressErrorHandler errorHandler) {
        this.remoteClient = Objects.requireNonNull(remoteClient, "remoteClient");
        this.sessionManager = Objects.requireNonNull(sessionManager, "sessionManager");
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
        Optional<PanierExpressSession> existing = sessionManager.current();
        if (!forceNew && existing.isPresent()) {
            return CompletableFuture.completedFuture(existing.get());
        }

        if (forceNew) {
            sessionManager.clear();
        }

        loading.set(true);
        CompletableFuture<PanierExpressSession> future = remoteClient.startNewGame(effective);
        future.whenComplete((session, error) -> {
            loading.set(false);
            if (error != null) {
                errorHandler.showError(error);
                return;
            }
            if (session != null) {
                sessionManager.save(session);
            }
        });
        return future;
    }

    PanierExpressGameOptions lastOptions() {
        return lastOptions;
    }
}
