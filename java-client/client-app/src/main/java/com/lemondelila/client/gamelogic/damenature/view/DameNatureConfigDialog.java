package com.lemondelila.client.gamelogic.damenature.view;

import com.lemondelila.client.gamelogic.damenature.service.DameNatureConfigState;

import javax.swing.JCheckBox;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import java.awt.GridLayout;
import java.util.Objects;

final class DameNatureConfigDialog {

    private final DameNatureConfigState configState;

    DameNatureConfigDialog(DameNatureConfigState configState) {
        this.configState = Objects.requireNonNull(configState, "configState");
    }

    void show(JPanel parent) {
        JCheckBox danger = new JCheckBox("Cartes danger", configState.dangerEnabled());
        JCheckBox quiz = new JCheckBox("Quiz nature", configState.quizEnabled());

        JPanel content = new JPanel(new GridLayout(0, 1, 6, 6));
        content.add(new JLabel("Préparer la partie Dame Nature"));
        content.add(danger);
        content.add(quiz);
        content.add(new JLabel("Entrée : valider, Échap : annuler."));

        int result = JOptionPane.showConfirmDialog(
                parent,
                content,
                "Configuration Dame Nature",
                JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.PLAIN_MESSAGE
        );

        if (result == JOptionPane.OK_OPTION) {
            configState.setDangerEnabled(danger.isSelected());
            configState.setQuizEnabled(quiz.isSelected());
        }
    }
}
