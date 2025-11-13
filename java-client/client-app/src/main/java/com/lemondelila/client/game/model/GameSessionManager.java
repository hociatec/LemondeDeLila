package com.lemondelila.client.game.model;

import java.util.concurrent.CompletableFuture;

public interface GameSessionManager<S extends GameSession<?>, A> extends GameLauncher<S> {

    CompletableFuture<S> refresh(int roomId);

    CompletableFuture<S> apply(int roomId, A action);
}
