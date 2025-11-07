package com.lemondelila.client.gamelogic.missionnemesis.view;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JPanel;
import java.awt.Component;

final class NemesisControlsPanel extends JPanel {

    private final JButton startButton = new JButton("Nouvelle partie");
    private final JButton autoPlaceButton = new JButton("Placement auto");
    private final JButton refreshButton = new JButton("Rafraichir");
    private final JButton resetButton = new JButton("Reinitialiser");

    NemesisControlsPanel() {
        setLayout(new BoxLayout(this, BoxLayout.X_AXIS));
        add(startButton);
        addSpacer();
        add(autoPlaceButton);
        addSpacer();
        add(refreshButton);
        addSpacer();
        add(resetButton);
    }

    JButton startButton() {
        return startButton;
    }

    JButton autoPlaceButton() {
        return autoPlaceButton;
    }

    JButton refreshButton() {
        return refreshButton;
    }

    JButton resetButton() {
        return resetButton;
    }

    void setAutoPlacementEnabled(boolean enabled) {
        autoPlaceButton.setEnabled(enabled);
    }

    void setRefreshEnabled(boolean enabled) {
        refreshButton.setEnabled(enabled);
    }

    void setResetEnabled(boolean enabled) {
        resetButton.setEnabled(enabled);
    }

    void resetState() {
        setAutoPlacementEnabled(false);
        setRefreshEnabled(false);
        setResetEnabled(false);
    }

    private void addSpacer() {
        Component spacer = Box.createHorizontalStrut(12);
        add(spacer);
    }
}

