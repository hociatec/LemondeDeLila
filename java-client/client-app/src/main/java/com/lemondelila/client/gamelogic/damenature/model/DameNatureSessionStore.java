package com.lemondelila.client.gamelogic.damenature.model;

import com.lemondelila.client.game.model.GameSessionStore;
import com.lemondelila.client.game.model.InMemoryGameSessionStore;

import java.util.Optional;

public final class DameNatureSessionStore implements GameSessionStore<DameNatureSession> {

    private final InMemoryGameSessionStore<DameNatureSession> delegate = new InMemoryGameSessionStore<>();

    @Override
    public void save(DameNatureSession session) {
        delegate.save(session);
    }

    @Override
    public Optional<DameNatureSession> find(int roomId) {
        return delegate.find(roomId);
    }

    @Override
    public Optional<DameNatureSession> current() {
        return delegate.current();
    }

    @Override
    public void clear(int roomId) {
        delegate.clear(roomId);
    }

    @Override
    public void clearAll() {
        delegate.clearAll();
    }
}
