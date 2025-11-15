package com.lemondelila.client.game.launcher;

import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.gamelogic.damenature.controller.DameNatureController;
import com.lemondelila.client.gamelogic.damenature.view.DameNatureScreen;

import com.lemondelila.client.framework.core.di.Inject;

import java.util.Objects;
import java.util.concurrent.CompletableFuture;

public final class DameNatureLauncher implements GameLauncher {

    private final DameNatureController controller;

    @Inject
    public DameNatureLauncher(DameNatureController controller) {
        this.controller = Objects.requireNonNull(controller, "controller");
    }

    @Override
    public CompletableFuture<ControllerResult> launch(GameSummary game) {
        String name = game == null ? "Dame Nature" : game.name();
        return controller.startNewGame()
                .thenApply(session -> ControllerResult.navigate(DameNatureScreen.ID)
                        .withStatus("Partie " + name + " lancée."));
    }
}
