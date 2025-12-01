package com.lemondelila.client.game.room.service;

/**
 * Pointe d'extension pour lancer une partie selon son type de jeu.
 */
public interface GameLaunchHandler {

    /**
     * Type de jeu pris en charge (ex : panier-express).
     */
    String gameType();

    /**
     * Demande le lancement de la partie pour la room donnťe.
     */
    void launch(int roomId);
}
