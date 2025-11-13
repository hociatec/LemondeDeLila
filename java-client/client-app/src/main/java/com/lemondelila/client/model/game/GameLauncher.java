package com.lemondelila.client.model.game;

import java.util.concurrent.CompletableFuture;

public interface GameLauncher<S extends GameSession<?>> {

    CompletableFuture<S> startNewGame();
}
