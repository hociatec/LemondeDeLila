package com.lemondelila.client.gamelogic.missionnemesis.view;

import javax.accessibility.AccessibleContext;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;

final class NemesisFooterPanel extends JPanel {

    private final JLabel phaseLabel = new JLabel("Phase : -");
    private final JLabel roundLabel = new JLabel("Manche : -");
    private final JLabel statusLabel = new JLabel(" ");

    NemesisFooterPanel() {
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        configureLabelAlignment();
        add(phaseLabel);
        add(Box.createVerticalStrut(4));
        add(roundLabel);
        add(Box.createVerticalStrut(8));
        add(statusLabel);
        getAccessibleContext().setAccessibleName("Informations Mission Nemesis");
        announce("Configuration requise. Utilisez les fleches puis Entree pour lancer une partie.");
    }

    void showPhase(String phase) {
        phaseLabel.setText("Phase : " + phase);
        announce("Phase : " + phase);
    }

    void showRound(int round) {
        roundLabel.setText("Manche : " + round);
        announce("Manche " + round);
    }

    void showStatus(String status) {
        statusLabel.setText(status);
        announce(status);
    }

    void reset() {
        phaseLabel.setText("Phase : -");
        roundLabel.setText("Manche : -");
        statusLabel.setText("Utilisez les fleches puis Entree pour lancer une partie.");
        announce("Configuration requise. Utilisez les fleches puis Entree pour lancer une partie.");
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
        AccessibleContext context = statusLabel.getAccessibleContext();
        if (context != null) {
            String oldDescription = context.getAccessibleDescription();
            String oldName = context.getAccessibleName();
            context.setAccessibleName(message);
            context.setAccessibleDescription(message);
            context.firePropertyChange(AccessibleContext.ACCESSIBLE_NAME_PROPERTY, oldName, message);
            context.firePropertyChange(AccessibleContext.ACCESSIBLE_DESCRIPTION_PROPERTY, oldDescription, message);
        }
    }
}
