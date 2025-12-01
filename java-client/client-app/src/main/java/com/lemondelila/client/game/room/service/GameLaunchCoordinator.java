package com.lemondelila.client.game.room.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.game.room.event.StartRoomRequested;

import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Coordonne le demarrage d'un jeu en fonction de son type.
 * Les jeux peuvent s'enregistrer via {@link #register(GameLaunchHandler)}.
 * En absence de handler specifique, un evenement {@link StartRoomRequested} est publie.
 */
public final class GameLaunchCoordinator {

    private final DomainEventBus eventBus;
    private final Map<String, GameLaunchHandler> handlers = new ConcurrentHashMap<>();

    @Inject
    public GameLaunchCoordinator(DomainEventBus eventBus) {
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
    }

    public void register(GameLaunchHandler handler) {
        if (handler == null || handler.gameType() == null || handler.gameType().isBlank()) {
            return;
        }
        handlers.put(normalize(handler.gameType()), handler);
    }

    public boolean launch(Integer roomId, String gameType) {
        if (roomId == null) {
            return false;
        }
        GameLaunchHandler handler = handlers.get(normalize(gameType));
        if (handler != null) {
            handler.launch(roomId);
            return true;
        }
        eventBus.publish(new StartRoomRequested(roomId));
        return true;
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }
}
