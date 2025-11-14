package com.lemondelila.client.game.model;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

public final class InMemoryGameSessionStore<S extends GameSession<?>> implements GameSessionStore<S> {

    private final Map<Integer, S> sessions = new ConcurrentHashMap<>();
    private final AtomicReference<S> current = new AtomicReference<>();

    @Override
    public void save(S session) {
        sessions.put(session.roomId(), session);
        current.set(session);
    }

    @Override
    public Optional<S> find(int roomId) {
        return Optional.ofNullable(sessions.get(roomId));
    }

    @Override
    public Optional<S> current() {
        return Optional.ofNullable(current.get());
    }

    @Override
    public void clear(int roomId) {
        S removed = sessions.remove(roomId);
        S snapshot = current.get();
        if (snapshot != null && snapshot.roomId() == roomId) {
            current.compareAndSet(snapshot, null);
        }
    }

    @Override
    public void clearAll() {
        sessions.clear();
        current.set(null);
    }

    public Collection<S> all() {
        return sessions.values();
    }
}
