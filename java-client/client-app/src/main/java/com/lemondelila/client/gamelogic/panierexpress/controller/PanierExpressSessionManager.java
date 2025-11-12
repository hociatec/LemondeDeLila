package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSessionStore;

import javax.swing.SwingUtilities;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

/**
 * Centralise la gestion d'état et la notification des sessions Panier Express côté client.
 */
final class PanierExpressSessionManager {

    private final PanierExpressSessionStore store;
    private final CopyOnWriteArrayList<Consumer<PanierExpressSession>> listeners = new CopyOnWriteArrayList<>();

    PanierExpressSessionManager(PanierExpressSessionStore store) {
        this.store = store;
    }

    Optional<PanierExpressSession> current() {
        return store.current();
    }

    void save(PanierExpressSession session) {
        store.save(session);
        publish(session);
    }

    void clear() {
        store.clear();
    }

    void addListener(Consumer<PanierExpressSession> listener) {
        listeners.add(listener);
        store.current().ifPresent(session ->
                SwingUtilities.invokeLater(() -> listener.accept(session))
        );
    }

    void removeListener(Consumer<PanierExpressSession> listener) {
        listeners.remove(listener);
    }

    private void publish(PanierExpressSession session) {
        for (Consumer<PanierExpressSession> listener : listeners) {
            SwingUtilities.invokeLater(() -> listener.accept(session));
        }
    }
}

