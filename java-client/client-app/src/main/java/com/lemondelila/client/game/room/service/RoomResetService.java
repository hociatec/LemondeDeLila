package com.lemondelila.client.game.room.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.room.event.ResetRoomRequested;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.Objects;

/**
 * Ecoute les demandes de réinitialisation et relaie la commande vers le backend.
 */
public final class RoomResetService implements AutoCloseable {

    private static final Logger LOGGER = LoggerFactory.getLogger(RoomResetService.class);

    private final RoomRealtimeService realtimeService;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public RoomResetService(DomainEventBus eventBus,
                            RoomRealtimeService realtimeService) {
        this.realtimeService = Objects.requireNonNull(realtimeService, "realtimeService");
        subscriptions.subscribe(eventBus, ResetRoomRequested.class, this::onResetRequested);
    }

    private void onResetRequested(ResetRoomRequested event) {
        if (event == null) {
            return;
        }
        int roomId = event.roomId();
        if (roomId <= 0) {
            return;
        }
        try {
            realtimeService.sendCommand("room.reset", Map.of("roomId", roomId));
        } catch (Exception ex) {
            LOGGER.debug("[room.reset] échec roomId={} message={}", roomId, ex.getMessage());
        }
    }

    @Override
    public void close() {
        subscriptions.close();
    }
}

