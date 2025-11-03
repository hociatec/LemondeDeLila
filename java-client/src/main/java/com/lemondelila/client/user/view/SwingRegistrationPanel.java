package com.lemondelila.client.user.view;

import javax.swing.*;
import java.awt.*;
import java.util.Objects;

/**
 * Panneau Swing encapsulant le formulaire d'inscription.
 */
public final class SwingRegistrationPanel extends JPanel implements RegistrationView {

    private static final Color COLOR_SUCCESS = new Color(0, 128, 0);
    private static final Color COLOR_ERROR = new Color(160, 0, 0);
    private static final Color COLOR_INFO = new Color(60, 60, 60);

    private final JTextField usernameField = new JTextField(20);
    private final JTextField emailField = new JTextField(20);
    private final JPasswordField passwordField = new JPasswordField(20);
    private final JButton registerButton = new JButton("Inscription");
    private final JLabel statusLabel = new JLabel(" ", SwingConstants.CENTER);

    private RegistrationListener listener;
    private Runnable switchToLoginAction;
    private Runnable backAction;

    public SwingRegistrationPanel() {
        super(new BorderLayout());
        initComponents();
    }

    private void initComponents() {
        setBorder(BorderFactory.createEmptyBorder(16, 16, 16, 16));

        JButton backButton = new JButton("Retour accueil");
        backButton.setFocusable(false);
        backButton.addActionListener(e -> triggerBackAction());

        JPanel topPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        topPanel.setOpaque(false);
        topPanel.add(backButton);

        JPanel formPanel = new JPanel(new GridBagLayout());
        GridBagConstraints gbc = new GridBagConstraints();
        gbc.insets = new Insets(8, 8, 8, 8);
        gbc.anchor = GridBagConstraints.WEST;
        gbc.fill = GridBagConstraints.HORIZONTAL;

        JLabel usernameLabel = new JLabel("Identifiant :");
        usernameLabel.setLabelFor(usernameField);

        JLabel emailLabel = new JLabel("Email :");
        emailLabel.setLabelFor(emailField);

        JLabel passwordLabel = new JLabel("Mot de passe :");
        passwordLabel.setLabelFor(passwordField);

        gbc.gridx = 0;
        gbc.gridy = 0;
        formPanel.add(usernameLabel, gbc);
        gbc.gridx = 1;
        formPanel.add(usernameField, gbc);

        gbc.gridx = 0;
        gbc.gridy = 1;
        formPanel.add(emailLabel, gbc);
        gbc.gridx = 1;
        formPanel.add(emailField, gbc);

        gbc.gridx = 0;
        gbc.gridy = 2;
        formPanel.add(passwordLabel, gbc);
        gbc.gridx = 1;
        formPanel.add(passwordField, gbc);

        gbc.gridx = 0;
        gbc.gridy = 3;
        gbc.gridwidth = 2;
        gbc.anchor = GridBagConstraints.CENTER;
        registerButton.setPreferredSize(new Dimension(140, 32));
        formPanel.add(registerButton, gbc);

        statusLabel.setForeground(COLOR_ERROR);
        statusLabel.setVisible(false);

        add(topPanel, BorderLayout.NORTH);
        add(formPanel, BorderLayout.CENTER);
        add(statusLabel, BorderLayout.SOUTH);

        registerButton.addActionListener(e -> notifyRegistrationRequested());
        passwordField.addActionListener(e -> notifyRegistrationRequested());
    }

    public void setSwitchToLoginAction(Runnable action) {
        this.switchToLoginAction = action;
    }

    public void setBackAction(Runnable backAction) {
        this.backAction = backAction;
    }

    public void onDisplayed(JRootPane rootPane) {
        if (rootPane != null) {
            rootPane.setDefaultButton(registerButton);
        }
        focusRegistrationUsername();
    }

    @Override
    public void setRegistrationListener(RegistrationListener listener) {
        this.listener = listener;
    }

    @Override
    public void setRegistrationLoading(boolean loading) {
        SwingUtilities.invokeLater(() -> {
            registerButton.setEnabled(!loading);
            usernameField.setEnabled(!loading);
            emailField.setEnabled(!loading);
            passwordField.setEnabled(!loading);
            if (loading) {
                statusLabel.setText("Inscription en cours...");
                statusLabel.setForeground(COLOR_INFO);
                statusLabel.setVisible(true);
            }
        });
    }

    @Override
    public void showRegistrationError(String message) {
        SwingUtilities.invokeLater(() -> {
            statusLabel.setForeground(COLOR_ERROR);
            statusLabel.setText(Objects.requireNonNullElse(message, "Erreur lors de l'inscription."));
            statusLabel.setVisible(true);
        });
    }

    @Override
    public void showRegistrationSuccess(String message) {
        SwingUtilities.invokeLater(() -> {
            statusLabel.setForeground(COLOR_SUCCESS);
            statusLabel.setText(Objects.requireNonNullElse(message, "Inscription reussie."));
            statusLabel.setVisible(true);
        });
    }

    @Override
    public void clearRegistrationForm() {
        SwingUtilities.invokeLater(() -> {
            usernameField.setText("");
            emailField.setText("");
            passwordField.setText("");
            statusLabel.setVisible(false);
        });
    }

    @Override
    public void clearRegistrationPassword() {
        SwingUtilities.invokeLater(() -> passwordField.setText(""));
    }

    @Override
    public void focusRegistrationUsername() {
        SwingUtilities.invokeLater(() -> usernameField.requestFocusInWindow());
    }

    @Override
    public void switchToLoginTab() {
        Runnable action = switchToLoginAction;
        if (action != null) {
            SwingUtilities.invokeLater(action);
        }
    }

    private void notifyRegistrationRequested() {
        if (listener == null) {
            return;
        }
        statusLabel.setVisible(false);
        listener.onRegistrationRequested(
                usernameField.getText().trim(),
                emailField.getText().trim(),
                passwordField.getPassword()
        );
    }

    private void triggerBackAction() {
        Runnable action = backAction;
        if (action != null) {
            SwingUtilities.invokeLater(action);
        }
    }

}
