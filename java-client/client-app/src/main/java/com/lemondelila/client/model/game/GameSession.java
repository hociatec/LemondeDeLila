package com.lemondelila.client.model.game;

import com.lemondelila.client.model.game.GameEngine.Score;

import java.util.Optional;

public interface GameSession<S> {

    String gameType();

    int roomId();

    S state();

    boolean finished();

    Optional<Score> score();
}
