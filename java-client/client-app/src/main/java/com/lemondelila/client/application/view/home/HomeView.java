package com.lemondelila.client.application.view.home;

import com.lemondelila.client.application.AppBranding;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.user.view.LoginFormPanel;
import com.lemondelila.client.user.view.RegisterFormPanel;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Component;
import java.awt.Dimension;

final class HomeView {

    enum Card {
        LANDING,
        LOGIN,
        REGISTER
    }

    private final JPanel root = new JPanel();
    private final JPanel cardPanel = new JPanel(new CardLayout());
    private final LandingPanel landingPanel = new LandingPanel();
    private final LoginFormPanel loginForm;
    private final RegisterFormPanel registerForm;
    private final JLabel statusLabel = new JLabel(" ");
    private Card currentCard = Card.LANDING;

    private final String applicationName;

    HomeView(FocusHighlighter focusHighlighter, AppBranding branding) {
        this.loginForm = new LoginFormPanel(focusHighlighter);
        this.registerForm = new RegisterFormPanel(focusHighlighter);
        this.applicationName = branding.applicationName();
        buildUi();
    }

    JPanel component() {
        return root;
    }

    LoginFormPanel loginForm() {
        return loginForm;
    }

    RegisterFormPanel registerForm() {
        return registerForm;
    }

    LandingPanel landingPanel() {
        return landingPanel;
    }

    JLabel statusLabel() {
        return statusLabel;
    }

    void showLanding() {
        showCard(Card.LANDING);
        setStatus(" ");
        landingPanel.requestFocusInWindow();
    }

    void showLogin() {
        showCard(Card.LOGIN);
        setStatus(" ");
    }

    void showRegister() {
        showCard(Card.REGISTER);
        setStatus(" ");
    }

    Card currentCard() {
        return currentCard;
    }

    private void showCard(Card target) {
        if (target == currentCard) {
            return;
        }
        currentCard = target;
        CardLayout layout = (CardLayout) cardPanel.getLayout();
        layout.show(cardPanel, target.name());
        if (target == Card.LOGIN) {
            loginForm.focusDefaultField();
        } else if (target == Card.REGISTER) {
            registerForm.focusDefaultField();
        }
    }

    void setStatus(String text) {
        statusLabel.setText(text == null || text.isBlank() ? " " : text);
    }

    private void buildUi() {
        root.setLayout(new BoxLayout(root, BoxLayout.Y_AXIS));
        root.setBorder(new EmptyBorder(48, 64, 48, 64));

        JLabel title = new JLabel("Bienvenue dans " + applicationName);
        title.setAlignmentX(Component.CENTER_ALIGNMENT);
        title.setFont(title.getFont().deriveFont(24f));
        root.add(title);
        root.add(Box.createRigidArea(new Dimension(0, 32)));

        cardPanel.setOpaque(false);
        cardPanel.setAlignmentX(Component.CENTER_ALIGNMENT);
        cardPanel.setMaximumSize(new Dimension(520, 360));
        cardPanel.add(landingPanel, Card.LANDING.name());
        cardPanel.add(loginForm, Card.LOGIN.name());
        cardPanel.add(registerForm, Card.REGISTER.name());
        root.add(cardPanel);
        root.add(Box.createRigidArea(new Dimension(0, 24)));

        statusLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        AccessibleDecorator.apply(statusLabel, AccessibleSpec.builder()
                .name("Zone de statut")
                .description("Affiche l'etat des actions de connexion et d'inscription")
                .build());
        root.add(statusLabel);

        showLanding();
    }
}
