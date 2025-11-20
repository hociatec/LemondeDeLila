package com.lemondelila.client.game.table;

/**
 * Représente l'état simplifié d'une table de jeu (lobby ou partie en cours).
 * Les implémentations peuvent ajouter leurs propres attributs, mais ces propriétés
 * suffisent pour décrire le nombre de participants et l'état général.
 */
public interface TableSnapshot {

    int id();

    int maxSeats();

    int humanPlayers();

    int botPlayers();

    String status();

    default int totalParticipants() {
        return Math.max(0, humanPlayers()) + Math.max(0, botPlayers());
    }

    default boolean hasBots() {
        return botPlayers() > 0;
    }

    default boolean isStarted() {
        String value = status();
        if (value == null) {
            return false;
        }
        return switch (value.toLowerCase()) {
            case "started", "playing", "running", "active" -> true;
            default -> false;
        };
    }

    default boolean isOpen() {
        return !isStarted();
    }
}
