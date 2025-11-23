package com.lemondelila.client.game.quiz.controller;

import com.lemondelila.client.game.core.controller.GenericGameInteractionController;
import com.lemondelila.client.game.quiz.model.QuizState;

import java.util.Optional;

/**
 * Contrôleur quiz : reçoit le pending quiz et transmet la réponse.
 */
public final class QuizController {

    private final GenericGameInteractionController interactionController;

    public QuizController(GenericGameInteractionController interactionController) {
        this.interactionController = interactionController;
    }

    public Optional<QuizState> mapPending(Object pendingQuiz) {
        if (!(pendingQuiz instanceof com.lemondelila.client.game.core.model.GenericGameState.PendingQuiz quiz)) {
            return Optional.empty();
        }
        return Optional.of(new QuizState(quiz.question(), quiz.choices(), quiz.playerId()));
    }

    public void answer(int choiceIndex) {
        interactionController.sendActions(java.util.List.of(
                com.lemondelila.client.game.core.model.ActionRequest.of("QUIZ_VALIDATE",
                        java.util.Map.of("choice", choiceIndex))
        ));
    }
}
