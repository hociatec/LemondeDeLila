package com.lemondelila.client.game.quiz.view;

import com.lemondelila.client.framework.access.FocusHighlighter;

/**
 * Fournit dynamiquement un composant quiz lorsque le module associé est actif.
 */
public interface GameQuizComponentFactory {

    /**
     * Crée un composant quiz prêt à être affiché dans la zone de jeu.
     */
    GameQuizComponent create(FocusHighlighter focusHighlighter);
}
