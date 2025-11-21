package com.lemondelila.client.game.core.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;

import javax.swing.JLabel;
import javax.swing.JPanel;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.util.List;
import java.util.Objects;

/**
 * Bloc générique pour afficher une question/quiz en lecture (sans boutons).
 */
public final class GameQuizPanel extends JPanel {

    private final JLabel questionLabel = new JLabel();
    private final JPanel choicesPanel = new JPanel(new GridLayout(0, 1, 4, 4));

    public GameQuizPanel(FocusHighlighter focusHighlighter) {
        super(new BorderLayout());
        Objects.requireNonNull(focusHighlighter, "focusHighlighter");
        setBorder(javax.swing.BorderFactory.createTitledBorder("Quiz"));
        AccessibleDecorator.apply(this, AccessibleSpec.builder()
                .name("Quiz")
                .description("Question et propositions")
                .build());
        focusHighlighter.apply(this);
        add(questionLabel, BorderLayout.NORTH);
        add(choicesPanel, BorderLayout.CENTER);
    }

    public void showQuiz(String question, List<String> choices) {
        choicesPanel.removeAll();
        questionLabel.setText(question == null ? "Question en cours" : question);
        if (choices != null) {
            for (int i = 0; i < choices.size(); i++) {
                String label = choices.get(i);
                JLabel choice = new JLabel((i + 1) + ". " + label);
                AccessibleDecorator.apply(choice, AccessibleSpec.builder()
                        .name("Reponse " + (i + 1))
                        .description(label)
                        .build());
                choicesPanel.add(choice);
            }
        }
        setVisible(true);
        revalidate();
        repaint();
    }

    public void clearQuiz() {
        questionLabel.setText("Pas de quiz en cours.");
        choicesPanel.removeAll();
        setVisible(false);
        revalidate();
        repaint();
    }
}
