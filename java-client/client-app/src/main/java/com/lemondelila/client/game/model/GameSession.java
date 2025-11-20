package com.lemondelila.client.game.model;

import com.lemondelila.client.game.model.GameEngine.Score;
import com.lemondelila.client.game.table.TableSnapshot;

import java.util.Optional;

public interface GameSession<S> {

    String gameType();

    int roomId();

    S state();

    boolean finished();

    Optional<Score> score();

    default Optional<TableSnapshot> tableInfo() {
        return Optional.empty();
    }
}
