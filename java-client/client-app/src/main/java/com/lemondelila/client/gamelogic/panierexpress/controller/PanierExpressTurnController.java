package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressRemoteClient;

import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * Gère les actions de tour de jeu (rafraîchissement, lancer de dé, quiz).
 */
final class PanierExpressTurnController {

    private final PanierExpressRemoteClient remoteClient;
    private final PanierExpressSessionManager sessionManager;
    private final PanierExpressErrorHandler errorHandler;

    PanierExpressTurnController(PanierExpressRemoteClient remoteClient,
                                PanierExpressSessionManager sessionManager,
                                PanierExpressErrorHandler errorHandler) {
        this.remoteClient = Objects.requireNonNull(remoteClient, "remoteClient");
        this.sessionManager = Objects.requireNonNull(sessionManager, "sessionManager");
        this.errorHandler = Objects.requireNonNull(errorHandler, "errorHandler");
    }

    CompletableFuture<PanierExpressSession> refreshGame() {
        Optional<PanierExpressSession> snapshot = sessionManager.current();
        if (snapshot.isEmpty()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Aucune partie active"));
        }
        CompletableFuture<PanierExpressSession> future = remoteClient.refresh(snapshot.get().roomId());
        future.whenComplete((session, error) -> {
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

    CompletableFuture<PanierExpressSession> roll() {
        Optional<PanierExpressSession> snapshot = sessionManager.current();
        if (snapshot.isEmpty()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Aucune partie active"));
        }
        CompletableFuture<PanierExpressSession> future = remoteClient.roll(snapshot.get().roomId());
        future.whenComplete((session, error) -> {
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

    CompletableFuture<PanierExpressSession> answerQuiz(int choice) {
        Optional<PanierExpressSession> snapshot = sessionManager.current();
        if (snapshot.isEmpty()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Aucune partie active"));
        }
        CompletableFuture<PanierExpressSession> future = remoteClient.answerQuiz(snapshot.get().roomId(), choice);
        future.whenComplete((session, error) -> {
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
}

