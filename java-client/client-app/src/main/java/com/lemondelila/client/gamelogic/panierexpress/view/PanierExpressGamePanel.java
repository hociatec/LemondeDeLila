package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.game.view.AbstractGamePanel;
import com.lemondelila.client.game.view.ChoicePanel;

import java.util.List;

public final class PanierExpressGamePanel extends AbstractGamePanel {

    private final ChoicePanel quizPanel = new ChoicePanel(
            Internationalization.text("panier.game.quiz.title"),
            Internationalization.text("panier.game.quiz.question.name"),
            Internationalization.text("panier.game.quiz.question.desc"),
            Internationalization.text("panier.game.quiz.choices.name"),
            Internationalization.text("panier.game.quiz.choices.desc"),
            Internationalization.text("panier.game.quiz.empty"));

    public PanierExpressGamePanel() {
        super(new GamePanelConfig(
                Internationalization.text("panier.game.status.name"),
                Internationalization.text("panier.game.status.desc"),
                Internationalization.text("panier.game.pending.name"),
                Internationalization.text("panier.game.pending.desc"),
                Internationalization.text("panier.game.history.title"),
                Internationalization.text("panier.game.history.accessible"),
                Internationalization.text("panier.game.history.desc"),
                Internationalization.text("panier.game.progress.self.title"),
                Internationalization.text("panier.game.progress.self.name"),
                Internationalization.text("panier.game.progress.self.desc"),
                Internationalization.text("panier.game.progress.players.title"),
                Internationalization.text("panier.game.progress.players.name"),
                Internationalization.text("panier.game.progress.players.desc"),
                Internationalization.text("panier.game.score.title"),
                Internationalization.text("panier.game.score.name"),
                Internationalization.text("panier.game.score.desc")
        ));
        customContentPanel().add(quizPanel, 0);
    }

    public void showQuiz(String question, List<String> choices) {
        quizPanel.showChoices(question, choices);
    }

    public void hideQuiz() {
        quizPanel.hideChoices();
    }
}
