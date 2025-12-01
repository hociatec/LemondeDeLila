package com.lemondelila.client.game.quiz.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;

import javax.swing.BorderFactory;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.border.Border;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.GridLayout;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Bloc générique pour afficher une question/quiz en lecture (sans boutons).
 */
public final class GameQuizPanel extends JPanel implements GameQuizComponent {

    private final JLabel questionLabel = new JLabel();
    private final JPanel choicesPanel = new JPanel(new GridLayout(0, 1, 4, 4));
    private final List<JLabel> choiceLabels = new ArrayList<>();
    private final Border highlightBorder = BorderFactory.createLineBorder(Color.ORANGE, 2);
    private final Border defaultBorder = BorderFactory.createEmptyBorder(2, 4, 2, 4);

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
        setVisible(false);
    }

    public void showQuiz(String question, List<String> choices) {
        choicesPanel.removeAll();
        choiceLabels.clear();
        questionLabel.setText(question == null ? "Question en cours" : question);
        if (choices != null) {
            for (int i = 0; i < choices.size(); i++) {
                String label = choices.get(i);
                JLabel choice = new JLabel((i + 1) + ". " + label);
                AccessibleDecorator.apply(choice, AccessibleSpec.builder()
                        .name("Reponse " + (i + 1))
                        .description(label)
                        .build());
                choice.setOpaque(true);
                choice.setBorder(defaultBorder);
                choicesPanel.add(choice);
                choiceLabels.add(choice);
            }
        }
        setVisible(true);
        revalidate();
        repaint();
        highlightChoice(-1);
    }

    public void clearQuiz() {
        questionLabel.setText("Pas de quiz en cours.");
        choicesPanel.removeAll();
        choiceLabels.clear();
        setVisible(false);
        revalidate();
        repaint();
    }

    @Override
    public javax.swing.JComponent getComponent() {
        return this;
    }

    @Override
    public void highlightChoice(int index) {
        for (int i = 0; i < choiceLabels.size(); i++) {
            JLabel label = choiceLabels.get(i);
            boolean focused = i == index;
            label.setBorder(focused ? highlightBorder : defaultBorder);
            label.setOpaque(focused);
            label.setBackground(focused ? Color.YELLOW : getBackground());
        }
    }
}
