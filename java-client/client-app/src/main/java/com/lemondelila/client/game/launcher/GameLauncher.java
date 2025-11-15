package com.lemondelila.client.game.launcher;

import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.framework.ui.ControllerResult;

import java.util.concurrent.CompletableFuture;

public interface GameLauncher {

    CompletableFuture<ControllerResult> launch(GameSummary game);
}
