package com.lemondelila.client.game.service;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Suit l'identifiant de la table actuellement ouverte côté client.
 * Permet au gateway temps réel de s'abonner sans dépendre d'un jeu précis.
 */
public final class ActiveRoomTracker {

    private final AtomicReference<Integer> currentRoom = new AtomicReference<>();

    public Optional<Integer> currentRoom() {
        return Optional.ofNullable(currentRoom.get());
    }

    public void setRoom(Integer roomId) {
        currentRoom.set(roomId);
    }

    public void clear() {
        currentRoom.set(null);
    }
}

