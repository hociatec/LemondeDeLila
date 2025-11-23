package com.lemondelila.client.game.realtime.service;

/**
 * Abstraction commune pour gérer un abonnement temps réel (SSE/WS) sur une room de jeu.
 */
public interface GameRealtimeManager extends AutoCloseable {

    /**
     * Souscrit au flux temps réel d'une room. Toute souscription en cours est annulée automatiquement
     * si une nouvelle est ouverte.
     *
     * @param roomId identifiant de la room
     * @return handle à fermer pour arrêter explicitement la souscription
     */
    AutoCloseable subscribe(int roomId);

    /**
     * Arrête toute souscription en cours.
     */
    @Override
    void close();
}
