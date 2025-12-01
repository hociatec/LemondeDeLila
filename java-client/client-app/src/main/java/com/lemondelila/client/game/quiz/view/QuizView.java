package com.lemondelila.client.game.quiz.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.game.quiz.model.QuizState;

import javax.swing.BorderFactory;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.BoxLayout;
import java.awt.event.ActionListener;
import java.util.List;
import java.util.function.Consumer;

/**
 * Vue minimale pour afficher un quiz (question + choix).
 * Le binding des réponses est fourni via un callback onAnswer.
 */
public final class QuizView extends JPanel {

    private final JLabel questionLabel = new JLabel();
    private Consumer<Integer> onAnswer = i -> {};

    public QuizView(FocusHighlighter highlighter) {
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        setBorder(BorderFactory.createTitledBorder("Quiz"));
        AccessibleDecorator.apply(questionLabel, AccessibleSpec.builder()
                .name("Question de quiz")
                .description("Question en cours")
                .build());
        highlighter.apply(questionLabel);
        add(questionLabel);
    }

    public void render(QuizState quiz) {
        removeAll();
        add(questionLabel);
        if (quiz == null) {
            questionLabel.setText("Pas de quiz en cours.");
            revalidate();
            repaint();
            return;
        }
        questionLabel.setText(quiz.question());
        List<String> choices = quiz.choices();
        for (int i = 0; i < choices.size(); i++) {
            final int idx = i;
            JButton btn = new JButton((i + 1) + ") " + choices.get(i));
            btn.addActionListener(e -> onAnswer.accept(idx));
            add(btn);
        }
        revalidate();
        repaint();
    }

    public void onAnswer(Consumer<Integer> callback) {
        this.onAnswer = callback == null ? i -> {} : callback;
    }
}
