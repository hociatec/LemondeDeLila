package com.lemondelila.client.game.presentation;

import com.lemondelila.client.game.model.GameSession;

/**
 * Contrat commun reliant un {@link com.lemondelila.client.game.plugin.GamePlugin}
 * à sa partie présentation (présentateur/vue). Chaque jeu expose ainsi une surface
 * homogène pouvant être orchestrée par les modules framework.
 *
 * @param <S> type de session propagée à l'écran.
 */
public interface GameScreenContract<S extends GameSession<?>> {

    /**
     * Vue Swing recevant les états de session d'un jeu.
     */
    interface View<S extends GameSession<?>> {

        /** Affiche l'écran de configuration/attente. */
        void showSetup();

        /** Affiche l'aire de jeu principale. */
        void showGameplay();

        /** Met à jour l'interface avec une session fraîche. */
        void renderSession(S session);

        /** Met à jour le statut utilisateur (bannière, footer, etc.). */
        void setStatusMessage(String message);

        /** Redonne le focus clavier à l'écran de jeu. */
        void requestGameplayFocus();
    }

    /**
     * Présentateur orchestrant la navigation configuration/jeu + rendu de session.
     */
    interface Presenter<S extends GameSession<?>> {

        /** Permet d'accrocher la vue concrète. */
        void bind(View<S> view);

        /** Notifié lorsque l'écran devient visible. */
        void onShow();

        /** Notifié lorsque l'écran disparaît. */
        void onHide();
    }
}
