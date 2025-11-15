package com.lemondelila.client.framework.core.event;

import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.function.Consumer;

/**
 * Bus d'événements simple (publish/subscribe).
 */
public final class DomainEventBus {

    private final Set<Subscriber<?>> subscribers = ConcurrentHashMap.newKeySet();

    public <T> AutoCloseable subscribe(Class<T> eventType, Consumer<T> consumer) {
        Objects.requireNonNull(eventType, "eventType");
        Objects.requireNonNull(consumer, "consumer");
        Subscriber<T> subscriber = new Subscriber<>(eventType, consumer);
        subscribers.add(subscriber);
        return () -> subscribers.remove(subscriber);
    }

    public <T> void publish(T event) {
        Objects.requireNonNull(event, "event");
        subscribers.stream()
                .filter(s -> s.accepts(event))
                .forEach(s -> s.dispatch(event));
    }

    private record Subscriber<T>(Class<T> eventType, Consumer<T> consumer) {
        boolean accepts(Object event) {
            return eventType.isInstance(event);
        }

        void dispatch(Object event) {
            consumer.accept(eventType.cast(event));
        }
    }
}

