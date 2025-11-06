package com.lemondelila.client.ui.screens;

import com.lemondelila.framework.access.AccessibleDecorator;
import com.lemondelila.framework.access.AccessibleSpec;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.AbstractAction;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.event.ActionEvent;

final class LandingPanel extends JPanel {

    private final JButton loginButton = new JButton("Se connecter");
    private final JButton registerButton = new JButton("Creer un compte");

    LandingPanel() {
        setOpaque(false);
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));

        loginButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(loginButton, AccessibleSpec.builder()
                .name("Bouton connexion")
                .shortcut("Alt+C")
                .build());
        enableEnter(loginButton);
        add(loginButton);

        add(Box.createRigidArea(new Dimension(0, 16)));

        registerButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(registerButton, AccessibleSpec.builder()
                .name("Bouton inscription")
                .shortcut("Alt+I")
                .build());
        enableEnter(registerButton);
        add(registerButton);
    }

    void onLogin(Runnable handler) {
        loginButton.addActionListener(e -> handler.run());
    }

    void onRegister(Runnable handler) {
        registerButton.addActionListener(e -> handler.run());
    }

    void setBusy(boolean busy) {
        loginButton.setEnabled(!busy);
        registerButton.setEnabled(!busy);
    }

    void focusDefault() {
        SwingUtilities.invokeLater(() -> loginButton.requestFocusInWindow());
    }

    private void enableEnter(JButton button) {
        button.getInputMap(JComponent.WHEN_FOCUSED)
                .put(KeyStroke.getKeyStroke("ENTER"), "press-enter");
        button.getActionMap().put("press-enter", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                button.doClick();
            }
        });
    }
}

