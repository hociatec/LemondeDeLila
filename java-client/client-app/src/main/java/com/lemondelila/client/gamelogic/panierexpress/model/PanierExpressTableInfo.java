package com.lemondelila.client.gamelogic.panierexpress.model;

import java.util.Objects;

/**
 * Représente l'état de la table temporaire côté moteur (joueurs, bots, statut).
 */
public record PanierExpressTableInfo(
        int id,
        int maxPlayers,
        int playerCount,
        int botCount,
        String status
) {

    public PanierExpressTableInfo {
        Objects.requireNonNull(status, "status");
    }

    public int totalParticipants() {
        return Math.max(0, playerCount) + Math.max(0, botCount);
    }

    public boolean isStarted() {
        return "started".equalsIgnoreCase(status) || "playing".equalsIgnoreCase(status);
    }
}

