package com.lemondelila.client.user.view;

import javax.swing.*;
import java.awt.*;
import java.util.Objects;

public class AuthPanel extends JPanel implements AuthView {

    private static final Color COLOR_SUCCESS = new Color(0, 128, 0);
    private static final Color COLOR_ERROR = new Color(160, 0, 0);
    private static final Color COLOR_INFO = new Color(60, 60, 60);

    private final JTextField usernameField = new JTextField(20);
    private final JPasswordField passwordField = new JPasswordField(20);
    private final JButton loginButton = new JButton("Connexion");
    private final JLabel statusLabel = new JLabel(" ", SwingConstants.CENTER);

    private LoginListener listener;
    private Runnable showFrameAction;
    private Runnable backAction;

    public AuthPanel() {
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

        JLabel passwordLabel = new JLabel("Mot de passe :");
        passwordLabel.setLabelFor(passwordField);

        gbc.gridx = 0;
        gbc.gridy = 0;
        formPanel.add(usernameLabel, gbc);

        gbc.gridx = 1;
        formPanel.add(usernameField, gbc);

        gbc.gridx = 0;
        gbc.gridy = 1;
        formPanel.add(passwordLabel, gbc);

        gbc.gridx = 1;
        formPanel.add(passwordField, gbc);

        gbc.gridx = 0;
        gbc.gridy = 2;
        gbc.gridwidth = 2;
        gbc.anchor = GridBagConstraints.CENTER;
        loginButton.setPreferredSize(new Dimension(140, 32));
        formPanel.add(loginButton, gbc);

        statusLabel.setForeground(COLOR_ERROR);
        statusLabel.setVisible(false);

        add(topPanel, BorderLayout.NORTH);
        add(formPanel, BorderLayout.CENTER);
        add(statusLabel, BorderLayout.SOUTH);

        loginButton.addActionListener(e -> notifyLoginRequested());
        passwordField.addActionListener(e -> notifyLoginRequested());
    }

    public void setShowFrameAction(Runnable action) {
        this.showFrameAction = action;
    }

    public void setBackAction(Runnable backAction) {
        this.backAction = backAction;
    }

    public void onDisplayed(JRootPane rootPane) {
        if (rootPane != null) {
            rootPane.setDefaultButton(loginButton);
        }
        focusUsername();
    }

    @Override
    public void setLoginListener(LoginListener listener) {
        this.listener = listener;
    }

    @Override
    public void showView() {
        Runnable action = showFrameAction;
        if (action != null) {
            SwingUtilities.invokeLater(action);
        } else {
            SwingUtilities.invokeLater(() -> {
                Window window = SwingUtilities.getWindowAncestor(AuthPanel.this);
                if (window instanceof JFrame frame && !frame.isVisible()) {
                    frame.setVisible(true);
                }
                focusUsername();
            });
        }
    }

    @Override
    public void setLoading(boolean loading) {
        SwingUtilities.invokeLater(() -> {
            loginButton.setEnabled(!loading);
            usernameField.setEnabled(!loading);
            passwordField.setEnabled(!loading);
            if (loading) {
                statusLabel.setText("Connexion en cours...");
                statusLabel.setForeground(COLOR_INFO);
                statusLabel.setVisible(true);
            }
        });
    }

    @Override
    public void showError(String message) {
        SwingUtilities.invokeLater(() -> {
            statusLabel.setForeground(COLOR_ERROR);
            statusLabel.setText(Objects.requireNonNullElse(message, "Erreur inconnue."));
            statusLabel.setVisible(true);
        });
    }

    @Override
    public void showSuccess(String message) {
        SwingUtilities.invokeLater(() -> {
            statusLabel.setForeground(COLOR_SUCCESS);
            statusLabel.setText(Objects.requireNonNullElse(message, "Connexion reussie."));
            statusLabel.setVisible(true);
        });
    }

    @Override
    public void clearPassword() {
        SwingUtilities.invokeLater(() -> passwordField.setText(""));
    }

    @Override
    public void focusUsername() {
        SwingUtilities.invokeLater(() -> usernameField.requestFocusInWindow());
    }

    private void notifyLoginRequested() {
        if (listener == null) {
            return;
        }
        statusLabel.setVisible(false);
        listener.onLoginRequested(usernameField.getText().trim(), passwordField.getPassword());
    }

    private void triggerBackAction() {
        Runnable action = backAction;
        if (action != null) {
            SwingUtilities.invokeLater(action);
        }
    }
}
