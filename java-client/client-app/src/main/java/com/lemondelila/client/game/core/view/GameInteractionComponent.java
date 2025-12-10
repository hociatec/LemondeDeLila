package com.lemondelila.client.game.core.view;

import com.lemondelila.client.framework.ui.screen.Screen;

public interface GameInteractionComponent extends Screen {
    /**
     * Appelé quand l'écran de table s'ouvre sur une room donnée.
     */
    void onAttach(int roomId);

    /**
     * Appelé quand on quitte la room ou qu'on change de jeu.
     */
    void onDetach();

    /**
     * Composant Swing à afficher.
     */
    javax.swing.JComponent getComponent();

    /**
     * Rafraîchir l'état du jeu (par défaut ne fait rien).
     * Appelé quand le serveur notifie un changement d'état (par ex. après un tour de bot).
     */
    default void refreshState() {
        // Default implementation does nothing
    }
}
