package com.lemondelila.client.user.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.ui.util.ButtonUtils;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.Dimension;
import java.util.Objects;
import java.util.function.Consumer;

public final class RegisterFormPanel extends JPanel {

    private final JTextField usernameField = new JTextField();
    private final JTextField emailField = new JTextField();
    private final JPasswordField passwordField = new JPasswordField();
    private final JButton submitButton = new JButton(Internationalization.text("home.register.submit"));
    private final JButton backButton = new JButton(Internationalization.text("home.register.back"));

    public RegisterFormPanel(FocusHighlighter focusHighlighter) {
        setOpaque(false);
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));

        JLabel usernameLabel = new JLabel(Internationalization.text("home.register.username.label"));
        AccessibleDecorator.apply(usernameLabel, AccessibleSpec.builder()
                .name(Internationalization.text("home.register.username.label"))
                .description(Internationalization.text("home.register.username.desc"))
                .build());
        add(usernameLabel);

        usernameField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 32));
        focusHighlighter.apply(usernameField);
        AccessibleDecorator.apply(usernameField, AccessibleSpec.builder()
                .name(Internationalization.text("home.register.username.field"))
                .description(Internationalization.text("home.register.username.field.desc"))
                .build());
        add(usernameField);

        add(Box.createRigidArea(new Dimension(0, 16)));

        JLabel emailLabel = new JLabel(Internationalization.text("home.register.email.label"));
        AccessibleDecorator.apply(emailLabel, AccessibleSpec.builder()
                .name(Internationalization.text("home.register.email.label"))
                .description(Internationalization.text("home.register.email.desc"))
                .build());
        add(emailLabel);

        emailField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 32));
        focusHighlighter.apply(emailField);
        AccessibleDecorator.apply(emailField, AccessibleSpec.builder()
                .name(Internationalization.text("home.register.email.field"))
                .description(Internationalization.text("home.register.email.field.desc"))
                .build());
        add(emailField);

        add(Box.createRigidArea(new Dimension(0, 16)));

        JLabel passwordLabel = new JLabel(Internationalization.text("home.register.password.label"));
        AccessibleDecorator.apply(passwordLabel, AccessibleSpec.builder()
                .name(Internationalization.text("home.register.password.label"))
                .description(Internationalization.text("home.register.password.desc"))
                .build());
        add(passwordLabel);

        passwordField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 32));
        focusHighlighter.apply(passwordField);
        AccessibleDecorator.apply(passwordField, AccessibleSpec.builder()
                .name(Internationalization.text("home.register.password.field"))
                .description(Internationalization.text("home.register.password.field.desc"))
                .build());
        add(passwordField);

        add(Box.createRigidArea(new Dimension(0, 24)));

        submitButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(submitButton, AccessibleSpec.builder()
                .name(Internationalization.text("home.register.submit.name"))
                .description(Internationalization.text("home.register.submit.desc"))
                .shortcut("Alt+I")
                .build());
        ButtonUtils.enterActivates(submitButton);
        add(submitButton);

        add(Box.createRigidArea(new Dimension(0, 8)));

        backButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(backButton, AccessibleSpec.builder()
                .name(Internationalization.text("home.register.back.name"))
                .description(Internationalization.text("home.register.back.desc"))
                .shortcut("Alt+R")
                .build());
        ButtonUtils.enterActivates(backButton);
        add(backButton);
    }

    public void onRegister(Consumer<RegistrationData> handler) {
        Objects.requireNonNull(handler, "handler");
        submitButton.addActionListener(e -> handler.accept(data()));
    }

    public void onBack(Runnable handler) {
        Objects.requireNonNull(handler, "handler");
        backButton.addActionListener(e -> handler.run());
    }

    public void clearAfterError() {
        SwingUtilities.invokeLater(() -> {
            passwordField.setText("");
            emailField.setText("");
        });
    }

    public void clearAfterSuccess() {
        SwingUtilities.invokeLater(() -> {
            passwordField.setText("");
            emailField.setText("");
            usernameField.setText("");
        });
    }

    public void setBusy(boolean busy) {
        submitButton.setEnabled(!busy);
        backButton.setEnabled(!busy);
        usernameField.setEnabled(!busy);
        emailField.setEnabled(!busy);
        passwordField.setEnabled(!busy);
    }

    public void focusDefaultField() {
        SwingUtilities.invokeLater(() -> usernameField.requestFocusInWindow());
    }

    private RegistrationData data() {
        return new RegistrationData(
                usernameField.getText().trim(),
                emailField.getText().trim(),
                passwordField.getPassword()
        );
    }

    public record RegistrationData(String username, String email, char[] password) {
    }
}
