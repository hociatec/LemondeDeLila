package com.lemondelila.client.gamelogic.missionnemesis.model;

import com.lemondelila.client.model.game.GameSessionStore;
import com.lemondelila.client.model.game.InMemoryGameSessionStore;

import java.util.Optional;

public final class NemesisSessionStore implements GameSessionStore<NemesisSession> {

    private final InMemoryGameSessionStore<NemesisSession> delegate = new InMemoryGameSessionStore<>();

    @Override
    public void save(NemesisSession session) {
        delegate.save(session);
    }

    @Override
    public Optional<NemesisSession> find(int roomId) {
        return delegate.find(roomId);
    }

    @Override
    public Optional<NemesisSession> current() {
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
