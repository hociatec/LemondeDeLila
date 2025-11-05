package com.lemondelila.client.ui;

import com.lemondelila.client.history.view.SwingHistoryView;
import com.lemondelila.client.menu.controller.MenuController;
import com.lemondelila.client.menu.view.SwingMainMenuView;
import com.lemondelila.client.rules.service.RulesService;
import com.lemondelila.client.user.view.SwingLoginPanel;
import com.lemondelila.client.user.view.SwingRegistrationPanel;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;

/**
 * Fenetre principale gerant la navigation entre accueil, connexion et inscription.
 */
public final class SwingAuthView extends JFrame {

    private static final String CARD_HOME = "home";
    private static final String CARD_LOGIN = "login";
    private static final String CARD_REGISTER = "register";
    private static final String CARD_CONNECTED = "connected";

    private final SwingLoginPanel loginPanel;
    private final SwingRegistrationPanel registrationPanel;
    private final SwingHistoryView historyView;
    private final KeyboardShortcutManager shortcutManager;
    private final HomePanel homePanel;
    private final RulesService rulesService;
    private final MenuController menuController;
    private JComponent connectedView;

    private final CardLayout cardLayout = new CardLayout();
    private final JPanel cardContainer = new JPanel(cardLayout);

    private static final String TITLE_HOME = "Accueil - Le Monde de Lila -";
    private static final String TITLE_LOGIN = "Connexion - Le Monde de Lila -";
    private static final String TITLE_REGISTER = "Inscription - Le Monde de Lila -";
    private static final String TITLE_CONNECTED = "Menu principal - Le Monde de Lila -";

    public SwingAuthView(SwingLoginPanel loginPanel,
                         SwingRegistrationPanel registrationPanel,
                         SwingHistoryView historyView,
                         RulesService rulesService,
                         MenuController menuController) {
        super(TITLE_HOME);
        this.loginPanel = loginPanel;
        this.registrationPanel = registrationPanel;
        this.historyView = historyView;
        this.rulesService = rulesService;
        this.menuController = menuController;
        this.shortcutManager = new KeyboardShortcutManager();
        this.shortcutManager.register(KeyStroke.getKeyStroke(KeyEvent.VK_F1, 0), "help", this::showHelp);

        setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);
        setMinimumSize(new Dimension(520, 520));

        this.homePanel = new HomePanel();
        homePanel.setLoginAction(this::showLoginPanel);
        homePanel.setRegisterAction(this::showRegistrationPanel);

        loginPanel.setBackAction(this::showHome);
        registrationPanel.setSwitchToLoginAction(this::showLoginPanel);
        registrationPanel.setBackAction(this::showHome);

        cardContainer.add(homePanel, CARD_HOME);
        cardContainer.add(loginPanel, CARD_LOGIN);
        cardContainer.add(registrationPanel, CARD_REGISTER);

        JPanel root = new JPanel(new BorderLayout());
        root.add(cardContainer, BorderLayout.CENTER);
        root.add(historyView, BorderLayout.SOUTH);

        setContentPane(root);
        shortcutManager.install(getRootPane());
        pack();
        setLocationRelativeTo(null);
        homePanel.requestInitialFocus();
    }

    public KeyboardShortcutManager shortcuts() {
        return shortcutManager;
    }

    public void setConnectedView(JComponent view) {
        SwingUtilities.invokeLater(() -> {
            if (connectedView != null) {
                cardContainer.remove(connectedView);
            }
            connectedView = view;
            if (connectedView != null) {
                cardContainer.add(connectedView, CARD_CONNECTED);
                cardContainer.revalidate();
                cardContainer.repaint();
            }
        });
    }

    public void showHome() {
        SwingUtilities.invokeLater(() -> {
            resetConnectedFocus();
            shortcutManager.clearBackActions();
            cardLayout.show(cardContainer, CARD_HOME);
            cardContainer.revalidate();
            cardContainer.repaint();
            JRootPane root = getRootPane();
            if (root != null) {
                root.setDefaultButton(null);
            }
            homePanel.requestInitialFocus();
            if (!isVisible()) {
                setVisible(true);
            }
            updateTitle(TITLE_HOME);
        });
    }

    public void showLoginPanel() {
        SwingUtilities.invokeLater(() -> {
            resetConnectedFocus();
            shortcutManager.replaceBackAction(this::showHome);
            cardLayout.show(cardContainer, CARD_LOGIN);
            cardContainer.revalidate();
            cardContainer.repaint();
            if (!isVisible()) {
                setVisible(true);
            }
            loginPanel.onDisplayed(getRootPane());
            updateTitle(TITLE_LOGIN);
        });
    }

    public void showRegistrationPanel() {
        SwingUtilities.invokeLater(() -> {
            resetConnectedFocus();
            shortcutManager.replaceBackAction(this::showHome);
            cardLayout.show(cardContainer, CARD_REGISTER);
            cardContainer.revalidate();
            cardContainer.repaint();
            if (!isVisible()) {
                setVisible(true);
            }
            registrationPanel.onDisplayed(getRootPane());
            updateTitle(TITLE_REGISTER);
        });
    }

    public void showConnectedView() {
        SwingUtilities.invokeLater(() -> {
            if (connectedView == null) {
                return;
            }
            shortcutManager.clearBackActions();
            cardLayout.show(cardContainer, CARD_CONNECTED);
            cardContainer.revalidate();
            cardContainer.repaint();
            JRootPane root = getRootPane();
            if (root != null) {
                root.setDefaultButton(null);
            }
            if (!isVisible()) {
                setVisible(true);
            }
            if (connectedView instanceof SwingMainMenuView menuView) {
                menuView.setFocusBridge(this::focusHistoryPanel, this::focusHistoryPanel);
                historyView.setFocusBridge(menuView::requestMenuFocus, menuView::requestMenuFocus);
                menuView.requestMenuFocus();
                updateTitle(TITLE_CONNECTED);
            } else {
                historyView.setFocusBridge(null, null);
                connectedView.requestFocusInWindow();
                updateTitle(TITLE_CONNECTED);
            }
        });
    }

    public void focusHistoryPanel() {
        historyView.requestHistoryFocus();
    }

    private void resetConnectedFocus() {
        if (connectedView instanceof SwingMainMenuView menuView) {
            menuView.setFocusBridge(null, null);
        }
        historyView.setFocusBridge(null, null);
    }

    private void updateTitle(String title) {
        setTitle(title);
    }

    private void showHelp() {
        String game = menuController.getCurrentGame();
        if (game == null) {
            game = "mission-nemesis"; // Default game
        }
        String rules = rulesService.getRules(game);
        JEditorPane editorPane = new JEditorPane("text/html", rules);
        editorPane.setEditable(false);
        JScrollPane scrollPane = new JScrollPane(editorPane);
        scrollPane.setPreferredSize(new Dimension(600, 400));
        JOptionPane.showMessageDialog(this, scrollPane, "Regles du jeu", JOptionPane.INFORMATION_MESSAGE);
    }

    private static final class HomePanel extends JPanel {

        private Runnable loginAction;
        private Runnable registerAction;
        private final JButton loginButton;

        HomePanel() {
            super(new BorderLayout());
            setBorder(BorderFactory.createEmptyBorder(24, 24, 24, 24));

            JLabel title = new JLabel("Accueil - Le Monde de Lila -", SwingConstants.CENTER);
            title.setFont(title.getFont().deriveFont(Font.BOLD, 20f));

            JLabel subtitle = new JLabel("Choisissez une action pour continuer", SwingConstants.CENTER);
            subtitle.setFont(subtitle.getFont().deriveFont(Font.PLAIN, 14f));

            JPanel titlePanel = new JPanel(new GridLayout(2, 1, 0, 8));
            titlePanel.setOpaque(false);
            titlePanel.add(title);
            titlePanel.add(subtitle);

            loginButton = new JButton("Se connecter");
            loginButton.setPreferredSize(new Dimension(160, 40));
            loginButton.setFocusable(true);
            loginButton.addActionListener(e -> trigger(loginAction));
            InputMap loginInputMap = loginButton.getInputMap(JComponent.WHEN_FOCUSED);
            loginInputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_ENTER, 0), "trigger-login");
            loginInputMap.put(KeyStroke.getKeyStroke("pressed SPACE"), "none");
            loginInputMap.put(KeyStroke.getKeyStroke("released SPACE"), "none");
            loginButton.getActionMap().put("trigger-login", new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    trigger(loginAction);
                }
            });
            loginButton.getActionMap().put("none", null);

            JButton registerButton = new JButton("S'inscrire");
            registerButton.setPreferredSize(new Dimension(160, 40));
            registerButton.setFocusable(true);
            registerButton.addActionListener(e -> trigger(registerAction));
            InputMap registerInputMap = registerButton.getInputMap(JComponent.WHEN_FOCUSED);
            registerInputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_ENTER, 0), "trigger-register");
            registerInputMap.put(KeyStroke.getKeyStroke("pressed SPACE"), "none");
            registerInputMap.put(KeyStroke.getKeyStroke("released SPACE"), "none");
            registerButton.getActionMap().put("trigger-register", new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    trigger(registerAction);
                }
            });
            registerButton.getActionMap().put("none", null);

            JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.CENTER, 24, 24));
            buttonPanel.setOpaque(false);
            buttonPanel.add(loginButton);
            buttonPanel.add(registerButton);

            add(titlePanel, BorderLayout.NORTH);
            add(buttonPanel, BorderLayout.CENTER);
        }

        void setLoginAction(Runnable loginAction) {
            this.loginAction = loginAction;
        }

        void setRegisterAction(Runnable registerAction) {
            this.registerAction = registerAction;
        }

        void requestInitialFocus() {
            SwingUtilities.invokeLater(() -> loginButton.requestFocusInWindow());
        }

        private static void trigger(Runnable action) {
            if (action != null) {
                action.run();
            }
        }
    }
}
