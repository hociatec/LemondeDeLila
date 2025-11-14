package com.lemondelila.client.game.model;

import com.lemondelila.client.game.model.GameEngine.Score;

import java.util.Optional;

public interface GameSession<S> {

    String gameType();

    int roomId();

    S state();

    boolean finished();

    Optional<Score> score();
}
