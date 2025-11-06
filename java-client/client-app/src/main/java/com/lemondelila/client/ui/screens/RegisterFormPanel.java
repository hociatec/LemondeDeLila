package com.lemondelila.client.ui.screens;

import com.lemondelila.framework.access.AccessibleDecorator;
import com.lemondelila.framework.access.AccessibleSpec;
import com.lemondelila.framework.access.FocusHighlighter;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.AbstractAction;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.event.ActionEvent;

final class RegisterFormPanel extends JPanel {

    private final JTextField usernameField = new JTextField();
    private final JTextField emailField = new JTextField();
    private final JPasswordField passwordField = new JPasswordField();
    private final JButton submitButton = new JButton("Valider l'inscription");
    private final JButton backButton = new JButton("Retour a l'accueil");

    RegisterFormPanel(FocusHighlighter focusHighlighter) {
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
        enableEnter(submitButton);
        add(submitButton);

        add(Box.createRigidArea(new Dimension(0, 8)));

        backButton.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(backButton, AccessibleSpec.builder()
                .name("Retour accueil")
                .shortcut("Alt+R")
                .build());
        enableEnter(backButton);
        add(backButton);
    }

    void onSubmit(Runnable handler) {
        submitButton.addActionListener(e -> handler.run());
    }

    void onBack(Runnable handler) {
        backButton.addActionListener(e -> handler.run());
    }

    String username() {
        return usernameField.getText().trim();
    }

    String email() {
        return emailField.getText().trim();
    }

    char[] password() {
        return passwordField.getPassword();
    }

    void clearAfterError() {
        SwingUtilities.invokeLater(() -> {
            passwordField.setText("");
            emailField.setText("");
        });
    }

    void clearAfterSuccess() {
        SwingUtilities.invokeLater(() -> {
            passwordField.setText("");
            emailField.setText("");
            usernameField.setText("");
        });
    }

    void setBusy(boolean busy) {
        submitButton.setEnabled(!busy);
        backButton.setEnabled(!busy);
        usernameField.setEnabled(!busy);
        emailField.setEnabled(!busy);
        passwordField.setEnabled(!busy);
    }

    void focusUsername() {
        SwingUtilities.invokeLater(() -> usernameField.requestFocusInWindow());
    }

    JButton submitButton() {
        return submitButton;
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
