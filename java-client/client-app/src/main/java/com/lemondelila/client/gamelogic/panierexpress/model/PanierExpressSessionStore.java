package com.lemondelila.client.gamelogic.panierexpress.model;

import com.lemondelila.client.game.model.GameSessionStore;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

public final class PanierExpressSessionStore implements GameSessionStore<PanierExpressSession> {

    private final AtomicReference<PanierExpressSession> session = new AtomicReference<>();

    @Override
    public void save(PanierExpressSession value) {
        session.set(value);
    }

    @Override
    public Optional<PanierExpressSession> find(int roomId) {
        return current().filter(s -> s.roomId() == roomId);
    }

    @Override
    public Optional<PanierExpressSession> current() {
        return Optional.ofNullable(session.get());
    }

    @Override
    public void clear(int roomId) {
        session.getAndUpdate(existing -> existing != null && existing.roomId() == roomId ? null : existing);
    }

    @Override
    public void clearAll() {
        session.set(null);
    }
}
