package com.lemondelila.client.user.view;

import javax.swing.*;
import java.awt.*;

public final class SwingLoginPanel extends JPanel {

    private final AuthPanel authPanel;

    public SwingLoginPanel() {
        super(new BorderLayout());
        authPanel = new AuthPanel();
        add(authPanel, BorderLayout.CENTER);
    }

    public AuthView getAuthView() {
        return authPanel;
    }

    public void setBackAction(Runnable backAction) {
        authPanel.setBackAction(backAction);
    }

    public void onDisplayed(JRootPane rootPane) {
        authPanel.onDisplayed(rootPane);
    }
}
