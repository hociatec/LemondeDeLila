package com.lemondelila.client.gamelogic.missionnemesis.controller;

import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;
import com.lemondelila.client.gamelogic.missionnemesis.service.NemesisRemoteClient;
import com.lemondelila.client.game.model.DialogGameErrorHandler;

import java.util.List;
import java.util.concurrent.CompletableFuture;

final class NemesisGameActions {

    private final NemesisRemoteClient remoteClient;
    private final DialogGameErrorHandler errorHandler;
    private final NemesisSessionCoordinator sessionCoordinator;

    NemesisGameActions(NemesisRemoteClient remoteClient,
                       DialogGameErrorHandler errorHandler,
                       NemesisSessionCoordinator sessionCoordinator) {
        this.remoteClient = remoteClient;
        this.errorHandler = errorHandler;
        this.sessionCoordinator = sessionCoordinator;
    }

    CompletableFuture<NemesisSession> startNewGame() {
        CompletableFuture<NemesisSession> future = remoteClient.startNewGame();
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show("Impossible de creer la partie Mission Nemesis", error);
                return;
            }
            if (session != null) {
                sessionCoordinator.updateSession(session);
            }
        });
        return future;
    }

    CompletableFuture<NemesisSession> refresh() {
        NemesisSession snapshot = sessionCoordinator.snapshot();
        if (snapshot == null) {
            return NemesisController.failedFuture(new IllegalStateException("Aucune partie active"));
        }
        CompletableFuture<NemesisSession> future = remoteClient.refresh(snapshot.roomId());
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show("Impossible de recuperer l'etat de la partie", error);
                return;
            }
            if (session != null) {
                sessionCoordinator.updateSession(session);
            }
        });
        return future;
    }

    CompletableFuture<NemesisSession> placeFleet(List<ShipPlacement> placements) {
        NemesisSession snapshot = sessionCoordinator.snapshot();
        if (snapshot == null) {
            return NemesisController.failedFuture(new IllegalStateException("Aucune partie active"));
        }
        CompletableFuture<NemesisSession> future = remoteClient.placeFleet(snapshot.roomId(), placements);
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show("Impossible de positionner la flotte", error);
                return;
            }
            if (session != null) {
                sessionCoordinator.updateSession(session);
            }
        });
        return future;
    }

    CompletableFuture<NemesisSession> fire(GridCoordinate coordinate) {
        NemesisSession snapshot = sessionCoordinator.snapshot();
        if (snapshot == null) {
            return NemesisController.failedFuture(new IllegalStateException("Aucune partie active"));
        }
        CompletableFuture<NemesisSession> future = remoteClient.fire(snapshot.roomId(), coordinate);
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show("Impossible de tirer", error);
                return;
            }
            if (session != null) {
                sessionCoordinator.updateSession(session);
            }
        });
        return future;
    }
}
