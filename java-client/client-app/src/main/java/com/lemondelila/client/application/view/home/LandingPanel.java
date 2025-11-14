package com.lemondelila.client.application.view.home;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.ui.util.ButtonUtils;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.Dimension;

final class LandingPanel extends JPanel {

    private final JButton loginButton = new JButton("Se connecter");
    private final JButton registerButton = new JButton("Créer un compte");
    private final JButton quitButton = new JButton("Quitter");

    LandingPanel() {
        setOpaque(false);
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));

        loginButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(loginButton, AccessibleSpec.builder()
                .name("Bouton connexion")
                .shortcut("Alt+C")
                .build());
        ButtonUtils.enterActivates(loginButton);
        add(loginButton);

        add(Box.createRigidArea(new Dimension(0, 16)));

        registerButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(registerButton, AccessibleSpec.builder()
                .name("Bouton inscription")
                .shortcut("Alt+I")
                .build());
        ButtonUtils.enterActivates(registerButton);
        add(registerButton);

        add(Box.createRigidArea(new Dimension(0, 16)));

        quitButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(quitButton, AccessibleSpec.builder()
                .name("Quitter l'application")
                .shortcut("Alt+Q")
                .build());
        ButtonUtils.enterActivates(quitButton);
        add(quitButton);
    }

    void onLogin(Runnable handler) {
        loginButton.addActionListener(e -> handler.run());
    }

    void onRegister(Runnable handler) {
        registerButton.addActionListener(e -> handler.run());
    }

    void onQuit(Runnable handler) {
        quitButton.addActionListener(e -> handler.run());
    }

    void setBusy(boolean busy) {
        loginButton.setEnabled(!busy);
        registerButton.setEnabled(!busy);
        quitButton.setEnabled(!busy);
    }

    void focusDefault() {
        SwingUtilities.invokeLater(() -> loginButton.requestFocusInWindow());
    }
}

