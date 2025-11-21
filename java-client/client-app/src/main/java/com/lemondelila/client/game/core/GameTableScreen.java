package com.lemondelila.client.game.core;

import com.lemondelila.client.framework.ui.screen.Screen;

import javax.swing.JComponent;

/**
 * Contrat minimal pour les ecrans de table de jeu.
 * Chaque jeu peut fournir son propre panneau d'interaction
 * tout en reutilisant l'encadrement generique (historique, raccourcis).
 */
public interface GameTableScreen extends Screen {

    /**
     * Zone principale d'interaction du jeu (recevra focus/tab).
     */
    JComponent interactionArea();

    /**
     * Intitule du jeu ou code jeu (pour l'entete / debug).
     */
    default String gameTitle() {
        return "";
    }
}
