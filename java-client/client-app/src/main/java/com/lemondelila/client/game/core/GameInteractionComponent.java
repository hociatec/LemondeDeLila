package com.lemondelila.client.game.core;

import javax.swing.JComponent;

/**
 * Repr��sente une interaction sp��cifique �� un jeu (zone de jeu) pouvant s'attacher/d��tacher d'une table.
 */
public interface GameInteractionComponent {

    /**
     * Composant Swing �� afficher dans la zone d'interaction.
     */
    JComponent component();

    /**
     * Appel�� quand l'��cran de table s'ouvre sur une room donn��e.
     */
    void onAttach(int roomId);

    /**
     * Appel�� quand on quitte la room ou qu'on change de jeu.
     */
    void onDetach();
}
