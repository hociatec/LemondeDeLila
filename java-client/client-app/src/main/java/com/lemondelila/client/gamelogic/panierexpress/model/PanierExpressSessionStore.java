package com.lemondelila.client.gamelogic.panierexpress.model;

import com.lemondelila.client.game.model.GameSessionStore;
import com.lemondelila.client.game.model.InMemoryGameSessionStore;

import java.util.Optional;

public final class PanierExpressSessionStore implements GameSessionStore<PanierExpressSession> {

    private final InMemoryGameSessionStore<PanierExpressSession> delegate = new InMemoryGameSessionStore<>();

    @Override
    public void save(PanierExpressSession value) {
        delegate.save(value);
    }

    @Override
    public Optional<PanierExpressSession> find(int roomId) {
        return delegate.find(roomId);
    }

    @Override
    public Optional<PanierExpressSession> current() {
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
