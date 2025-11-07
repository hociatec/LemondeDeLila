package com.lemondelila.client.gamelogic.missionnemesis.view;

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
    }

    void showPhase(String phase) {
        phaseLabel.setText("Phase : " + phase);
    }

    void showRound(int round) {
        roundLabel.setText("Manche : " + round);
    }

    void showStatus(String status) {
        statusLabel.setText(status);
    }

    void reset() {
        phaseLabel.setText("Phase : -");
        roundLabel.setText("Manche : -");
        statusLabel.setText("Cliquez sur \"Nouvelle partie\" pour commencer.");
    }

    private void configureLabelAlignment() {
        phaseLabel.setAlignmentX(LEFT_ALIGNMENT);
        roundLabel.setAlignmentX(LEFT_ALIGNMENT);
        statusLabel.setAlignmentX(LEFT_ALIGNMENT);
    }
}

