package com.lemondelila.client.game.room.view;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.room.event.RoomOperationFailed;
import com.lemondelila.client.game.room.event.RoomUpdated;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Minimal presenter that logs room updates; UI panels can subscribe to the same events.
 */
public final class RoomPresenter implements AutoCloseable {

    private static final Logger LOGGER = LoggerFactory.getLogger(RoomPresenter.class);
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    public RoomPresenter(DomainEventBus eventBus) {
        subscriptions.subscribe(eventBus, RoomUpdated.class, e -> {
            if (e.room() != null) {
                LOGGER.info("Table mise à jour: id={} name={} status={}", e.room().id(), e.room().name(), e.room().status());
            }
        });
        subscriptions.subscribe(eventBus, RoomOperationFailed.class, e ->
                LOGGER.warn("Action table échouée: {}", e.message()));
    }

    @Override
    public void close() {
        subscriptions.close();
    }
}
