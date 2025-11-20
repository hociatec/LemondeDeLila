package com.lemondelila.client.game.session;

import com.lemondelila.client.game.model.GameSession;
import com.lemondelila.client.game.model.GameSessionStore;
import com.lemondelila.client.game.model.InMemoryGameSessionStore;

import java.util.Optional;

/**
 * Base de stockage mémoire simple que les jeux peuvent étendre pour
 * éviter de réimplémenter la délégation vers {@link InMemoryGameSessionStore}.
 */
public abstract class InMemoryDelegatingSessionStore<S extends GameSession<?>>
        implements GameSessionStore<S> {

    private final InMemoryGameSessionStore<S> delegate = new InMemoryGameSessionStore<>();

    @Override
    public void save(S session) {
        delegate.save(session);
    }

    @Override
    public Optional<S> find(int roomId) {
        return delegate.find(roomId);
    }

    @Override
    public Optional<S> current() {
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

    protected InMemoryGameSessionStore<S> delegate() {
        return delegate;
    }
}
