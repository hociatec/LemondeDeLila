package com.lemondelila.client.model.game;

import java.util.Optional;

public interface GameSessionStore<S extends GameSession<?>> {

    void save(S session);

    Optional<S> find(int roomId);

    Optional<S> current();

    void clear(int roomId);

    void clearAll();
}
