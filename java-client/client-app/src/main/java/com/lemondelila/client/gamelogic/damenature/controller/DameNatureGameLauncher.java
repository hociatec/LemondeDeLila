package com.lemondelila.client.gamelogic.damenature.controller;

import com.lemondelila.client.gamelogic.damenature.model.DameNatureConfig;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSession;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureRemoteClient;
import com.lemondelila.client.game.model.DialogGameErrorHandler;
import com.lemondelila.client.game.model.GameSessionTracker;

import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;

final class DameNatureGameLauncher {

    private final DameNatureRemoteClient remoteClient;
    private final GameSessionTracker<DameNatureSession> sessions;
    private final DialogGameErrorHandler errorHandler;
    private final AtomicBoolean loading = new AtomicBoolean(false);

    private volatile DameNatureConfig lastConfig = DameNatureConfig.defaultConfig();

    DameNatureGameLauncher(DameNatureRemoteClient remoteClient,
                           GameSessionTracker<DameNatureSession> sessions,
                           DialogGameErrorHandler errorHandler) {
        this.remoteClient = Objects.requireNonNull(remoteClient, "remoteClient");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.errorHandler = Objects.requireNonNull(errorHandler, "errorHandler");
    }

    CompletableFuture<DameNatureSession> startGame() {
        return startGame(lastConfig);
    }

    CompletableFuture<DameNatureSession> startGame(DameNatureConfig config) {
        DameNatureConfig effective = config == null ? DameNatureConfig.defaultConfig() : config;
        lastConfig = effective;
        if (loading.get()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Initialisation en cours"));
        }
        loading.set(true);
        CompletableFuture<DameNatureSession> future = remoteClient.startNewGame(effective);
        future.whenComplete((session, error) -> {
            loading.set(false);
            if (error != null) {
                errorHandler.show("Impossible de creer la partie Dame Nature", error);
                return;
            }
            if (session != null) {
                sessions.save(session);
            }
        });
        return future;
    }

    DameNatureConfig lastConfig() {
        return lastConfig;
    }

    void reset() {
        loading.set(false);
        lastConfig = DameNatureConfig.defaultConfig();
    }
}
