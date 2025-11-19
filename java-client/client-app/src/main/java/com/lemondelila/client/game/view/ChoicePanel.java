package com.lemondelila.client.game.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextArea;
import java.awt.Dimension;
import java.util.List;
import java.util.Objects;

public final class ChoicePanel extends JPanel {

    private final JLabel questionLabel = new JLabel(" ");
    private final JTextArea choicesArea = new JTextArea();
    private final String emptyText;

    public ChoicePanel(String title,
                       String questionName,
                       String questionDesc,
                       String choicesName,
                       String choicesDesc,
                       String emptyText) {
        setOpaque(false);
        setAlignmentX(LEFT_ALIGNMENT);
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        setBorder(javax.swing.BorderFactory.createTitledBorder(title));
        AccessibleDecorator.apply(questionLabel, AccessibleSpec.builder()
                .name(questionName)
                .description(questionDesc)
                .build());
        AccessibleDecorator.apply(choicesArea, AccessibleSpec.builder()
                .name(choicesName)
                .description(choicesDesc)
                .build());
        choicesArea.setLineWrap(true);
        choicesArea.setWrapStyleWord(true);
        choicesArea.setEditable(false);
        choicesArea.setFocusable(false);
        add(questionLabel);
        add(Box.createRigidArea(new Dimension(0, 6)));
        add(new javax.swing.JScrollPane(choicesArea));
        this.emptyText = Objects.requireNonNullElse(emptyText, "");
        hideChoices();
    }

    public void showChoices(String question, List<String> choices) {
        setVisible(true);
        questionLabel.setText(question == null ? " " : question);
        StringBuilder builder = new StringBuilder();
        if (choices != null) {
            for (int i = 0; i < choices.size(); i++) {
                builder.append("Touche ").append(i + 1).append(" : ").append(choices.get(i)).append('\n');
            }
        }
        String text = builder.toString().strip();
        choicesArea.setText(text);
        choicesArea.getAccessibleContext().setAccessibleDescription(text);
    }

    public void hideChoices() {
        setVisible(false);
        questionLabel.setText(" ");
        choicesArea.setText(emptyText);
        choicesArea.getAccessibleContext().setAccessibleDescription(emptyText);
    }
}

