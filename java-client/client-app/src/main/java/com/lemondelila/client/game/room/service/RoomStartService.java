package com.lemondelila.client.game.room.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.room.event.StartRoomRequested;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.Objects;

/**
 * Ecoute les demandes de démarrage et relaie la commande vers le backend.
 */
public final class RoomStartService implements AutoCloseable {

    private static final Logger LOGGER = LoggerFactory.getLogger(RoomStartService.class);

    private final RoomRealtimeService realtimeService;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public RoomStartService(DomainEventBus eventBus,
                            RoomRealtimeService realtimeService) {
        this.realtimeService = Objects.requireNonNull(realtimeService, "realtimeService");
        subscriptions.subscribe(eventBus, StartRoomRequested.class, this::onStartRequested);
    }

    private void onStartRequested(StartRoomRequested event) {
        if (event == null) {
            return;
        }
        int roomId = event.roomId();
        if (roomId <= 0) {
            return;
        }
        try {
            realtimeService.sendCommand("room.start", Map.of("roomId", roomId));
        } catch (Exception ex) {
            // Normalement relayé via le canal temps réel, mais on garde une trace pour debug.
            LOGGER.debug("[room.start] échec roomId={} message={}", roomId, ex.getMessage());
        }
    }

    @Override
    public void close() {
        subscriptions.close();
    }
}
