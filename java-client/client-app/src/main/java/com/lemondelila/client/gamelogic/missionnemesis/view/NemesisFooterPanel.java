package com.lemondelila.client.gamelogic.missionnemesis.view;

import com.lemondelila.framework.access.game.AccessibilityService;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;

final class NemesisFooterPanel extends JPanel {

    private final AccessibilityService accessibilityService;

    private final JLabel phaseLabel = new JLabel("Phase : -");
    private final JLabel roundLabel = new JLabel("Manche : -");
    private final JLabel statusLabel = new JLabel(" ");

    NemesisFooterPanel(AccessibilityService accessibilityService) {
        this.accessibilityService = accessibilityService;
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        configureLabelAlignment();
        add(phaseLabel);
        add(Box.createVerticalStrut(4));
        add(roundLabel);
        add(Box.createVerticalStrut(8));
        add(statusLabel);
        getAccessibleContext().setAccessibleName("Informations Mission Nemesis");
        announce("Configuration requise. Utilisez les flèches puis Entrée pour lancer une partie.");
    }

    void showPhase(String phase) {
        String message = "Phase : " + phase;
        phaseLabel.setText(message);
        announce(message);
    }

    void showRound(int round) {
        String message = "Manche : " + round;
        roundLabel.setText(message);
        announce(message);
    }

    void showStatus(String status) {
        statusLabel.setText(status);
        announce(status);
    }

    void reset() {
        phaseLabel.setText("Phase : -");
        roundLabel.setText("Manche : -");
        statusLabel.setText("Utilisez les flèches puis Entrée pour lancer une partie.");
        announce("Configuration requise. Utilisez les flèches puis Entrée pour lancer une partie.");
    }

    private void configureLabelAlignment() {
        phaseLabel.setAlignmentX(LEFT_ALIGNMENT);
        roundLabel.setAlignmentX(LEFT_ALIGNMENT);
        statusLabel.setAlignmentX(LEFT_ALIGNMENT);
    }

    private void announce(String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        accessibilityService.announceCustom(statusLabel, message);
    }
}
