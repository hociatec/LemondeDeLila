package com.lemondelila.client.gamelogic.missionnemesis.view;

import com.lemondelila.client.framework.access.game.AccessibilityService;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;

final class NemesisFooterPanel extends JPanel {

    private final AccessibilityService accessibilityService;

    private final JLabel phaseLabel = new JLabel("Phase : -");
    private final JLabel roundLabel = new JLabel("Manche : -");
    private final JLabel participantsLabel = new JLabel("Bots détectés : aucun.");
    private final JLabel statusLabel = new JLabel(" ");

    NemesisFooterPanel(AccessibilityService accessibilityService) {
        this.accessibilityService = accessibilityService;
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        configureLabelAlignment();
        add(phaseLabel);
        add(Box.createVerticalStrut(4));
        add(roundLabel);
        add(Box.createVerticalStrut(4));
        add(participantsLabel);
        add(Box.createVerticalStrut(8));
        add(statusLabel);
        getAccessibleContext().setAccessibleName("Informations Mission Nemesis");
        if (participantsLabel.getAccessibleContext() != null) {
            participantsLabel.getAccessibleContext().setAccessibleName("Bots détectés");
            participantsLabel.getAccessibleContext().setAccessibleDescription(participantsLabel.getText());
        }
        statusLabel.setText("");
        if (statusLabel.getAccessibleContext() != null) {
            statusLabel.getAccessibleContext().setAccessibleDescription("");
        }
    }

    void showPhase(String phase) {
        String message = "Phase : " + phase;
        phaseLabel.setText(message);
        announce(phaseLabel, message);
    }

    void showRound(int round) {
        String message = "Manche : " + round;
        roundLabel.setText(message);
        announce(roundLabel, message);
    }

    void showParticipants(String info) {
        String display = (info == null || info.isBlank()) ? "Bots détectés : aucun." : info;
        boolean changed = !display.equals(participantsLabel.getText());
        participantsLabel.setText(display);
        if (participantsLabel.getAccessibleContext() != null) {
            participantsLabel.getAccessibleContext().setAccessibleDescription(display);
        }
        if (changed) {
            announce(participantsLabel, display);
        }
    }

    void showStatus(String status) {
        statusLabel.setText(status);
        if (statusLabel.getAccessibleContext() != null) {
            statusLabel.getAccessibleContext().setAccessibleDescription(status);
        }
        announce(statusLabel, status);
    }

    void reset() {
        phaseLabel.setText("Phase : -");
        roundLabel.setText("Manche : -");
        showParticipants("Bots détectés : aucun.");
        statusLabel.setText("");
        if (statusLabel.getAccessibleContext() != null) {
            statusLabel.getAccessibleContext().setAccessibleDescription("");
        }
    }

    private void configureLabelAlignment() {
        phaseLabel.setAlignmentX(LEFT_ALIGNMENT);
        roundLabel.setAlignmentX(LEFT_ALIGNMENT);
        participantsLabel.setAlignmentX(LEFT_ALIGNMENT);
        statusLabel.setAlignmentX(LEFT_ALIGNMENT);
    }

    private void announce(JLabel target, String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        accessibilityService.announceCustom(target, message);
    }
}
