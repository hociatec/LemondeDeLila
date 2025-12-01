package com.lemondelila.client.framework.core.event;

import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

/**
 * Regroupe plusieurs inscriptions (événements, listeners) et garantit leur libération
 * en une seule opération.
 */
public final class EventSubscriptions implements AutoCloseable {

    private final CopyOnWriteArrayList<AutoCloseable> handles = new CopyOnWriteArrayList<>();

    /**
     * Ajoute un handle existant et le retournera tel quel pour l'enchaînement.
     */
    public <T extends AutoCloseable> T add(T handle) {
        if (handle != null) {
            handles.add(handle);
        }
        return handle;
    }

    /**
     * Inscrit un consommateur sur le {@link DomainEventBus} et enregistre automatiquement l'abonnement.
     */
    public <E> AutoCloseable subscribe(DomainEventBus eventBus,
                                       Class<E> eventType,
                                       Consumer<E> listener) {
        Objects.requireNonNull(eventBus, "eventBus");
        Objects.requireNonNull(eventType, "eventType");
        Objects.requireNonNull(listener, "listener");
        AutoCloseable handle = eventBus.subscribe(eventType, listener);
        add(handle);
        return handle;
    }

    /**
     * Libère toutes les inscriptions suivies.
     */
    @Override
    public void close() {
        handles.forEach(EventSubscriptions::closeQuietly);
        handles.clear();
    }

    public void clear() {
        close();
    }

    private static void closeQuietly(AutoCloseable closeable) {
        if (closeable == null) {
            return;
        }
        try {
            closeable.close();
        } catch (Exception ignored) {
        }
    }
}
