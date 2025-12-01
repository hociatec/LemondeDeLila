package com.lemondelila.client.home.view;

import com.lemondelila.client.application.Internationalization;
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

public final class LandingPanel extends JPanel {

    private final JButton loginButton = new JButton(Internationalization.text("home.landing.login"));
    private final JButton registerButton = new JButton(Internationalization.text("home.landing.register"));
    private final JButton quitButton = new JButton(Internationalization.text("home.landing.quit"));

    public LandingPanel() {
        setOpaque(false);
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));

        loginButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(loginButton, AccessibleSpec.builder()
                .name(Internationalization.text("home.landing.login.name"))
                .description(Internationalization.text("home.landing.login.desc"))
                .shortcut("Alt+C")
                .build());
        ButtonUtils.enterActivates(loginButton);
        add(loginButton);

        add(Box.createRigidArea(new Dimension(0, 16)));

        registerButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(registerButton, AccessibleSpec.builder()
                .name(Internationalization.text("home.landing.register.name"))
                .description(Internationalization.text("home.landing.register.desc"))
                .shortcut("Alt+I")
                .build());
        ButtonUtils.enterActivates(registerButton);
        add(registerButton);

        add(Box.createRigidArea(new Dimension(0, 16)));

        quitButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(quitButton, AccessibleSpec.builder()
                .name(Internationalization.text("home.landing.quit.name"))
                .description(Internationalization.text("home.landing.quit.desc"))
                .shortcut("Alt+Q")
                .build());
        ButtonUtils.enterActivates(quitButton);
        add(quitButton);
    }

    public void onLogin(Runnable handler) {
        loginButton.addActionListener(e -> handler.run());
    }

    public void onRegister(Runnable handler) {
        registerButton.addActionListener(e -> handler.run());
    }

    public void onQuit(Runnable handler) {
        quitButton.addActionListener(e -> handler.run());
    }

    public void setBusy(boolean busy) {
        loginButton.setEnabled(!busy);
        registerButton.setEnabled(!busy);
        quitButton.setEnabled(!busy);
    }

    public void focusDefault() {
        SwingUtilities.invokeLater(() -> loginButton.requestFocusInWindow());
    }
}

