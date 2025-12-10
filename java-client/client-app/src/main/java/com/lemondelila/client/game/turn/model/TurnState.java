package com.lemondelila.client.game.turn.model;

/**
 * Modèle de données pour l'état du tour (round, index, direction, joueur courant).
 */
public record TurnState(int round, int index, int direction, Integer currentPlayerId) {
    public String directionLabel() {
        return direction == -1 ? "sens antihoraire" : "sens horaire";
    }
}
