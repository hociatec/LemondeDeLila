package com.lemondelila.client.view.user;

import com.lemondelila.framework.access.AccessibleDecorator;
import com.lemondelila.framework.access.AccessibleSpec;
import com.lemondelila.framework.access.FocusHighlighter;
import com.lemondelila.framework.ui.util.ButtonUtils;

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

public final class LoginFormPanel extends JPanel {

    private final JTextField usernameField = new JTextField();
    private final JPasswordField passwordField = new JPasswordField();
    private final JButton submitButton = new JButton("Se connecter");
    private final JButton backButton = new JButton("Retour a l'accueil");

    public LoginFormPanel(FocusHighlighter focusHighlighter) {
        setOpaque(false);
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));

        JLabel usernameLabel = new JLabel("Nom d'utilisateur");
        AccessibleDecorator.apply(usernameLabel, AccessibleSpec.builder()
                .name("Nom d'utilisateur")
                .description("Champ pour saisir votre identifiant")
                .build());
        add(usernameLabel);

        usernameField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 32));
        focusHighlighter.apply(usernameField);
        AccessibleDecorator.apply(usernameField, AccessibleSpec.builder()
                .name("Champ nom d'utilisateur")
                .description("Saisissez votre identifiant de connexion")
                .build());
        add(usernameField);

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
                .description("Saisissez votre mot de passe")
                .build());
        add(passwordField);

        add(Box.createRigidArea(new Dimension(0, 24)));

        submitButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(submitButton, AccessibleSpec.builder()
                .name("Bouton valider la connexion")
                .shortcut("Alt+C")
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
    }

    public void focusDefaultField() {
        SwingUtilities.invokeLater(() -> usernameField.requestFocusInWindow());
    }

    public void clearPassword() {
        SwingUtilities.invokeLater(() -> passwordField.setText(""));
    }

    public LoginCredentials credentials() {
        return new LoginCredentials(usernameField.getText().trim(), passwordField.getPassword());
    }

    public record LoginCredentials(String username, char[] password) {
    }
}


