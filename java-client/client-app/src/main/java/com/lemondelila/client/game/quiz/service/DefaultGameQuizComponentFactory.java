package com.lemondelila.client.game.quiz.service;

import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.game.quiz.view.GameQuizComponent;
import com.lemondelila.client.game.quiz.view.GameQuizComponentFactory;
import com.lemondelila.client.game.quiz.view.GameQuizPanel;

/**
 * Implémentation par défaut du composant quiz (vue Swing).
 */
public final class DefaultGameQuizComponentFactory implements GameQuizComponentFactory {

    @Override
    public GameQuizComponent create(FocusHighlighter focusHighlighter) {
        return new GameQuizPanel(focusHighlighter);
    }
}
