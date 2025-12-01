package com.lemondelila.client.game.room.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.room.event.StartRoomRequested;

import java.util.Map;
import java.util.Objects;

/**
 * Ecoute les demandes de dИmarrrage et relaie la commande vers le backend.
 */
public final class RoomStartService implements AutoCloseable {

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
        } catch (Exception ignored) {
            // Les erreurs seront relayИes via le canal temps rИel (RoomOperationFailed).
        }
    }

    @Override
    public void close() {
        subscriptions.close();
    }
}
