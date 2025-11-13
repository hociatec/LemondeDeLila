package com.lemondelila.client.game.model;

import com.lemondelila.client.framework.core.event.DomainEventBus;

import javax.swing.SwingUtilities;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

public final class GameSessionTracker<S extends GameSession<?>> {

    private final GameSessionStore<S> store;
    private final DomainEventBus eventBus;
    private final CopyOnWriteArrayList<Consumer<S>> listeners = new CopyOnWriteArrayList<>();

    public GameSessionTracker(GameSessionStore<S> store, DomainEventBus eventBus) {
        this.store = store;
        this.eventBus = eventBus;
    }

    public Optional<S> current() {
        return store.current();
    }

    public Optional<S> find(int roomId) {
        return store.find(roomId);
    }

    public void save(S session) {
        S previous = store.find(session.roomId()).orElse(null);
        store.save(session);
        GameSessionEvents.publishTransition(eventBus, previous, session);
        notifyListeners(session);
    }

    public void clear(int roomId) {
        S previous = store.find(roomId).orElse(null);
        store.clear(roomId);
        GameSessionEvents.publishTransition(eventBus, previous, null);
    }

    public void clearAll() {
        Optional<S> previous = store.current();
        store.clearAll();
        previous.ifPresent(session -> GameSessionEvents.publishTransition(eventBus, session, null));
    }

    public AutoCloseable listen(Consumer<S> listener) {
        listeners.add(listener);
        store.current().ifPresent(session ->
                SwingUtilities.invokeLater(() -> listener.accept(session))
        );
        return () -> listeners.remove(listener);
    }

    private void notifyListeners(S session) {
        for (Consumer<S> listener : listeners) {
            SwingUtilities.invokeLater(() -> listener.accept(session));
        }
    }
}
