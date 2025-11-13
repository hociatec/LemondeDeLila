package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressRemoteClient;
import com.lemondelila.client.game.model.DialogGameErrorHandler;
import com.lemondelila.client.game.model.GameSessionTracker;

import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * Gère les actions de tour de jeu (rafraîchissement, lancer de dé, quiz).
 */
final class PanierExpressTurnController {

    private final PanierExpressRemoteClient remoteClient;
    private final GameSessionTracker<PanierExpressSession> sessionTracker;
    private final DialogGameErrorHandler errorHandler;

    PanierExpressTurnController(PanierExpressRemoteClient remoteClient,
                                GameSessionTracker<PanierExpressSession> sessionTracker,
                                DialogGameErrorHandler errorHandler) {
        this.remoteClient = Objects.requireNonNull(remoteClient, "remoteClient");
        this.sessionTracker = Objects.requireNonNull(sessionTracker, "sessionTracker");
        this.errorHandler = Objects.requireNonNull(errorHandler, "errorHandler");
    }

    CompletableFuture<PanierExpressSession> refreshGame() {
        Optional<PanierExpressSession> snapshot = sessionTracker.current();
        if (snapshot.isEmpty()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Aucune partie active"));
        }
        CompletableFuture<PanierExpressSession> future = remoteClient.refresh(snapshot.get().roomId());
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show("Impossible de rafraichir la partie", error);
                return;
            }
            if (session != null) {
                sessionTracker.save(session);
            }
        });
        return future;
    }

    CompletableFuture<PanierExpressSession> roll() {
        Optional<PanierExpressSession> snapshot = sessionTracker.current();
        if (snapshot.isEmpty()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Aucune partie active"));
        }
        CompletableFuture<PanierExpressSession> future = remoteClient.roll(snapshot.get().roomId());
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show("Impossible de lancer le dé", error);
                return;
            }
            if (session != null) {
                sessionTracker.save(session);
            }
        });
        return future;
    }

    CompletableFuture<PanierExpressSession> answerQuiz(int choice) {
        Optional<PanierExpressSession> snapshot = sessionTracker.current();
        if (snapshot.isEmpty()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Aucune partie active"));
        }
        CompletableFuture<PanierExpressSession> future = remoteClient.answerQuiz(snapshot.get().roomId(), choice);
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show("Impossible d'envoyer la reponse au quiz", error);
                return;
            }
            if (session != null) {
                sessionTracker.save(session);
            }
        });
        return future;
    }
}

