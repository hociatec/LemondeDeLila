package com.lemondelila.client.game.model;

import java.util.concurrent.CompletableFuture;

public interface GameLauncher<S extends GameSession<?>> {

    CompletableFuture<S> startNewGame();
}
