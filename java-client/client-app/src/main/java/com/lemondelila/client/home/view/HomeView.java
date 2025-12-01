package com.lemondelila.client.home.view;

import com.lemondelila.client.application.AppBranding;
import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.ui.component.StatusBanner;
import com.lemondelila.client.framework.ui.component.StatusBannerFactory;
import com.lemondelila.client.user.view.LoginFormPanel;
import com.lemondelila.client.user.view.RegisterFormPanel;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.border.EmptyBorder;
import java.awt.CardLayout;
import java.awt.Component;
import java.awt.Dimension;

public final class HomeView {

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
    private final StatusBanner statusBanner;
    private Card currentCard = Card.LANDING;

    private final String applicationName;

    public HomeView(FocusHighlighter focusHighlighter, AppBranding branding, StatusBannerFactory statusBannerFactory) {
        this.loginForm = new LoginFormPanel(focusHighlighter);
        this.registerForm = new RegisterFormPanel(focusHighlighter);
        this.applicationName = branding.applicationName();
        this.statusBanner = statusBannerFactory.create(
                Internationalization.text("home.status.banner.name"),
                Internationalization.text("home.status.banner.desc"),
                root
        );
        buildUi();
    }

    public JPanel component() {
        return root;
    }

    public LoginFormPanel loginForm() {
        return loginForm;
    }

    public RegisterFormPanel registerForm() {
        return registerForm;
    }

    public LandingPanel landingPanel() {
        return landingPanel;
    }

    public void showLanding() {
        showCard(Card.LANDING);
        setStatus(" ");
        landingPanel.requestFocusInWindow();
    }

    public void showLogin() {
        showCard(Card.LOGIN);
        setStatus(" ");
    }

    public void showRegister() {
        showCard(Card.REGISTER);
        setStatus(" ");
    }

    public Card currentCard() {
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

    public void setStatus(String text) {
        statusBanner.setStatus(text);
    }

    private void buildUi() {
        root.setLayout(new BoxLayout(root, BoxLayout.Y_AXIS));
        root.setBorder(new EmptyBorder(48, 64, 48, 64));

        JLabel title = new JLabel(Internationalization.text("home.heading", applicationName));
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

        JLabel statusLabel = statusBanner.component();
        statusLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        root.add(statusLabel);

        showLanding();
    }
}
