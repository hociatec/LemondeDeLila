package com.lemondelila.client.game.launcher;

import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.gamelogic.missionnemesis.controller.NemesisController;
import com.lemondelila.client.gamelogic.missionnemesis.view.NemesisScreen;

import com.lemondelila.client.framework.core.di.Inject;

import java.util.Objects;
import java.util.concurrent.CompletableFuture;

public final class NemesisLauncher implements GameLauncher {

    private final NemesisController controller;

    @Inject
    public NemesisLauncher(NemesisController controller) {
        this.controller = Objects.requireNonNull(controller, "controller");
    }

    @Override
    public CompletableFuture<ControllerResult> launch(GameSummary game) {
        String name = game == null ? "Mission Nemesis" : game.name();
        return controller.startNewGame()
                .thenApply(session -> ControllerResult.navigate(NemesisScreen.ID)
                        .withStatus("Partie " + name + " lancée."));
    }
}
