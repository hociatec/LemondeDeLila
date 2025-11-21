package com.lemondelila.client.game.core;

/**
 * Fournit une zone d'interaction sp��cifique �� un jeu.
 */
public interface GameInteractionProvider {

    /**
     * Code du jeu (ex: "panier-express").
     */
    String gameType();

    /**
     * Cr��e le composant d'interaction pour la table courante.
     */
    GameInteractionComponent create();
}
