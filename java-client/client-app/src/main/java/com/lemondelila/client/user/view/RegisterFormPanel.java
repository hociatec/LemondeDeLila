package com.lemondelila.client.user.view;

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
    private final JButton submitButton = new JButton("Valider l'inscription");
    private final JButton backButton = new JButton("Retour a l'accueil");

    public RegisterFormPanel(FocusHighlighter focusHighlighter) {
        setOpaque(false);
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));

        JLabel usernameLabel = new JLabel("Nom d'utilisateur");
        AccessibleDecorator.apply(usernameLabel, AccessibleSpec.builder()
                .name("Nom d'utilisateur")
                .description("Champ pour saisir le nom affiche")
                .build());
        add(usernameLabel);

        usernameField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 32));
        focusHighlighter.apply(usernameField);
        AccessibleDecorator.apply(usernameField, AccessibleSpec.builder()
                .name("Champ nom d'utilisateur")
                .description("Saisissez le nom d'utilisateur souhaite")
                .build());
        add(usernameField);

        add(Box.createRigidArea(new Dimension(0, 16)));

        JLabel emailLabel = new JLabel("Adresse e-mail");
        AccessibleDecorator.apply(emailLabel, AccessibleSpec.builder()
                .name("Adresse e-mail")
                .description("Champ pour saisir votre adresse e-mail")
                .build());
        add(emailLabel);

        emailField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 32));
        focusHighlighter.apply(emailField);
        AccessibleDecorator.apply(emailField, AccessibleSpec.builder()
                .name("Champ adresse e-mail")
                .description("Saisissez votre e-mail pour creer le compte")
                .build());
        add(emailField);

        add(Box.createRigidArea(new Dimension(0, 16)));

        JLabel passwordLabel = new JLabel("Mot de passe");
        AccessibleDecorator.apply(passwordLabel, AccessibleSpec.builder()
                .name("Mot de passe")
                .description("Champ pour saisir votre mot de passe")
                .build());
        add(passwordLabel);

        passwordField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 32));
        focusHighlighter.apply(passwordField);
        AccessibleDecorator.apply(passwordField, AccessibleSpec.builder()
                .name("Champ mot de passe")
                .description("Saisissez un mot de passe d'au moins six caracteres")
                .build());
        add(passwordField);

        add(Box.createRigidArea(new Dimension(0, 24)));

        submitButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(submitButton, AccessibleSpec.builder()
                .name("Bouton valider l'inscription")
                .shortcut("Alt+I")
                .build());
        ButtonUtils.enterActivates(submitButton);
        add(submitButton);

        add(Box.createRigidArea(new Dimension(0, 8)));

        backButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(backButton, AccessibleSpec.builder()
                .name("Retour accueil")
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
