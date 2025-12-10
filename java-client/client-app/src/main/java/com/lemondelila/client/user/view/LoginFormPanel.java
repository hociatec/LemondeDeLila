package com.lemondelila.client.user.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.ui.util.ButtonUtils;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JCheckBox;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;
import java.awt.CardLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.util.Objects;
import java.util.function.Consumer;

public final class LoginFormPanel extends JPanel {

    private final JTextField usernameField = new JTextField();
    private final JPasswordField passwordField = new JPasswordField();
    private final JTextField passwordPlainField = new JTextField();
    private final JPanel passwordCard = new JPanel(new CardLayout());
    private final JCheckBox passwordVisibilityToggle = new JCheckBox("Afficher le mot de passe", false);
    private final char passwordEchoChar;
    private final JCheckBox rememberCredentials = new JCheckBox(Internationalization.text("home.login.remember.label"));
    private final JButton submitButton = new JButton(Internationalization.text("home.login.submit"));
    private final JButton backButton = new JButton(Internationalization.text("home.login.back"));

    public LoginFormPanel(FocusHighlighter focusHighlighter) {
        setOpaque(false);
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        this.passwordEchoChar = resolveMaskChar(passwordField.getEchoChar());

        JLabel usernameLabel = new JLabel(Internationalization.text("home.login.username.label"));
        AccessibleDecorator.apply(usernameLabel, AccessibleSpec.builder()
                .name(Internationalization.text("home.login.username.label"))
                .description(Internationalization.text("home.login.username.desc"))
                .build());
        add(usernameLabel);

        usernameField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 32));
        focusHighlighter.apply(usernameField);
        AccessibleDecorator.apply(usernameField, AccessibleSpec.builder()
                .name(Internationalization.text("home.login.username.field"))
                .description(Internationalization.text("home.login.username.field.desc"))
                .build());
        add(usernameField);

        add(Box.createRigidArea(new Dimension(0, 16)));

        JLabel passwordLabel = new JLabel(Internationalization.text("home.login.password.label"));
        AccessibleDecorator.apply(passwordLabel, AccessibleSpec.builder()
                .name(Internationalization.text("home.login.password.label"))
                .description(Internationalization.text("home.login.password.desc"))
                .build());
        add(passwordLabel);

        passwordField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 32));
        passwordPlainField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 32));
        focusHighlighter.apply(passwordField);
        focusHighlighter.apply(passwordPlainField);
        AccessibleDecorator.apply(passwordField, AccessibleSpec.builder()
                .name(Internationalization.text("home.login.password.field"))
                .description(Internationalization.text("home.login.password.field.desc"))
                .build());
        AccessibleDecorator.apply(passwordPlainField, AccessibleSpec.builder()
                .name(Internationalization.text("home.login.password.field"))
                .description(Internationalization.text("home.login.password.field.desc"))
                .build());
        passwordCard.setOpaque(false);
        passwordCard.add(passwordField, "masked");
        passwordCard.add(passwordPlainField, "visible");
        ((CardLayout) passwordCard.getLayout()).show(passwordCard, "masked");
        add(passwordCard);

        passwordVisibilityToggle.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(passwordVisibilityToggle, AccessibleSpec.builder()
                .name("Affichage du mot de passe")
                .description("Cochez pour afficher le mot de passe saisi, décochez pour le masquer.")
                .build());
        passwordVisibilityToggle.addActionListener(e -> togglePasswordVisibility());
        add(passwordVisibilityToggle);

        add(Box.createRigidArea(new Dimension(0, 24)));

        rememberCredentials.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(rememberCredentials, AccessibleSpec.builder()
                .name(Internationalization.text("home.login.remember.name"))
                .description(Internationalization.text("home.login.remember.desc"))
                .build());
        add(rememberCredentials);

        add(Box.createRigidArea(new Dimension(0, 8)));

        submitButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(submitButton, AccessibleSpec.builder()
                .name(Internationalization.text("home.login.submit.name"))
                .description(Internationalization.text("home.login.submit.desc"))
                .shortcut("Alt+C")
                .build());
        ButtonUtils.enterActivates(submitButton);
        add(submitButton);

        add(Box.createRigidArea(new Dimension(0, 8)));

        backButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(backButton, AccessibleSpec.builder()
                .name(Internationalization.text("home.login.back.name"))
                .description(Internationalization.text("home.login.back.desc"))
                .shortcut("Alt+R")
                .build());
        ButtonUtils.enterActivates(backButton);
        add(backButton);
    }

    public void onLogin(Consumer<LoginCredentials> handler) {
        Objects.requireNonNull(handler, "handler");
        submitButton.addActionListener(e -> handler.accept(credentials()));
    }

    public void onBack(Runnable handler) {
        Objects.requireNonNull(handler, "handler");
        backButton.addActionListener(e -> handler.run());
    }

    public void setBusy(boolean busy) {
        submitButton.setEnabled(!busy);
        backButton.setEnabled(!busy);
        usernameField.setEnabled(!busy);
        passwordField.setEnabled(!busy);
        passwordPlainField.setEnabled(!busy);
        passwordVisibilityToggle.setEnabled(!busy);
        rememberCredentials.setEnabled(!busy);
    }

    public void focusDefaultField() {
        SwingUtilities.invokeLater(() -> usernameField.requestFocusInWindow());
    }

    public void clearPassword() {
        SwingUtilities.invokeLater(() -> {
            passwordField.setText("");
            passwordPlainField.setText("");
            restorePasswordMask();
        });
    }

    public LoginCredentials credentials() {
        char[] pwd;
        if (isPasswordVisible()) {
            pwd = passwordPlainField.getText().toCharArray();
        } else {
            pwd = passwordField.getPassword();
        }
        return new LoginCredentials(usernameField.getText().trim(), pwd);
    }

    public void setRememberCredentials(boolean enabled) {
        rememberCredentials.setSelected(enabled);
    }

    public boolean rememberCredentialsSelected() {
        return rememberCredentials.isSelected();
    }

    public void fillCredentials(String username, char[] password) {
        usernameField.setText(username != null ? username : "");
        if (password != null) {
            String pwdStr = String.valueOf(password);
            passwordField.setText(pwdStr);
            passwordPlainField.setText(pwdStr);
        }
    }

    private void togglePasswordVisibility() {
        boolean show = passwordVisibilityToggle.isSelected();
        CardLayout cl = (CardLayout) passwordCard.getLayout();
        if (show) {
            passwordPlainField.setText(getMaskedPassword());
            cl.show(passwordCard, "visible");
            passwordPlainField.requestFocusInWindow();
            passwordPlainField.setCaretPosition(passwordPlainField.getText().length());
            passwordVisibilityToggle.setText("Masquer le mot de passe");
        } else {
            passwordField.setText(getVisiblePassword());
            restorePasswordMask();
            cl.show(passwordCard, "masked");
            passwordField.requestFocusInWindow();
            passwordField.setCaretPosition(passwordField.getPassword().length);
        }
    }

    private void restorePasswordMask() {
        passwordField.setEchoChar(passwordEchoChar);
        passwordVisibilityToggle.setSelected(false);
        passwordVisibilityToggle.setText("Afficher le mot de passe");
        ((CardLayout) passwordCard.getLayout()).show(passwordCard, "masked");
    }

    private char resolveMaskChar(char initial) {
        return initial != 0 ? initial : '*';
    }

    private boolean isPasswordVisible() {
        return passwordVisibilityToggle.isSelected();
    }

    private String getVisiblePassword() {
        return isPasswordVisible() ? passwordPlainField.getText() : new String(passwordField.getPassword());
    }

    private String getMaskedPassword() {
        return new String(passwordField.getPassword());
    }

    public record LoginCredentials(String username, char[] password) {
    }
}
