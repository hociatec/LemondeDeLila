package com.lemondelila.client.ui.screens;

import com.lemondelila.client.chat.ChatConnectionFactory;
import com.lemondelila.client.session.ClientSession;
import com.lemondelila.client.settings.AppSettingsService;
import com.lemondelila.client.ui.chat.ChatWindow;
import com.lemondelila.client.ui.options.OptionsDialog;
import com.lemondelila.client.ui.presence.PresenceListDialog;
import com.lemondelila.framework.ui.dialog.DialogService;
import com.lemondelila.framework.ui.screen.Screen;
import com.lemondelila.framework.ui.screen.ScreenContext;
import com.lemondelila.framework.ui.screen.ScreenManager;
import com.lemondelila.framework.ui.util.ButtonUtils;

import javax.swing.AbstractAction;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.List;

public final class MainMenuScreen extends JPanel implements Screen {

    private static final String ACTION_SHOW_PRESENCE = "main-menu.show-presence";
    private static final String ACTION_NAV_UP = "main-menu.nav-up.";
    private static final String ACTION_NAV_DOWN = "main-menu.nav-down.";

    private final DialogService dialogService;
    private final AppSettingsService settingsService;
    private final ChatConnectionFactory chatConnectionFactory;
    private final ClientSession session;

    private final JLabel statusLabel = new JLabel(" ");
    private final JButton shelvesButton = new JButton("Etageres");
    private final JButton joinGameButton = new JButton("Rejoindre une partie");
    private final JButton chatButton = new JButton("Tchat");
    private final JButton optionsButton = new JButton("Options");
    private final JButton logoutButton = new JButton("Se deconnecter");

    private final List<JButton> menuButtons = new ArrayList<>();

    private ScreenManager screenManager;
    private ChatWindow chatWindow;

    public MainMenuScreen(DialogService dialogService,
                          AppSettingsService settingsService,
                          ChatConnectionFactory chatConnectionFactory,
                          ClientSession session) {
        this.dialogService = dialogService;
        this.settingsService = settingsService;
        this.chatConnectionFactory = chatConnectionFactory;
        this.session = session;
        buildUi();
        registerHandlers();
        registerShortcuts();
        registerNavigation();
    }

    private void buildUi() {
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        setBorder(javax.swing.BorderFactory.createEmptyBorder(48, 64, 48, 64));

        JLabel title = new JLabel("Menu principal");
        title.setAlignmentX(Component.CENTER_ALIGNMENT);
        title.setFont(title.getFont().deriveFont(26f));
        add(title);
        add(Box.createRigidArea(new Dimension(0, 32)));

        addMenuButton(shelvesButton);
        addSpacer();
        addMenuButton(joinGameButton);
        addSpacer();
        addMenuButton(chatButton);
        addSpacer();
        addMenuButton(optionsButton);
        add(Box.createRigidArea(new Dimension(0, 24)));
        addMenuButton(logoutButton);

        add(Box.createRigidArea(new Dimension(0, 24)));
        statusLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        add(statusLabel);
    }

    private void addMenuButton(JButton button) {
        button.setAlignmentX(Component.CENTER_ALIGNMENT);
        button.setMaximumSize(new Dimension(320, 48));
        button.setFocusTraversalKeysEnabled(false);
        ButtonUtils.enterActivates(button);
        menuButtons.add(button);
        add(button);
    }

    private void addSpacer() {
        add(Box.createRigidArea(new Dimension(0, 12)));
    }

    private void registerHandlers() {
        shelvesButton.addActionListener(e -> featureSoon("Etageres"));
        joinGameButton.addActionListener(e -> featureSoon("Rejoindre une partie"));
        chatButton.addActionListener(e -> openChat());
        optionsButton.addActionListener(e -> openOptions());
        logoutButton.addActionListener(e -> logout());
    }

    private void registerShortcuts() {
        getInputMap(WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("control U"), ACTION_SHOW_PRESENCE);
        getActionMap().put(ACTION_SHOW_PRESENCE, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                openPresenceDialog();
            }
        });
    }

    private void registerNavigation() {
        for (int i = 0; i < menuButtons.size(); i++) {
            JButton button = menuButtons.get(i);
            int currentIndex = i;
            int previousIndex = i - 1;
            int nextIndex = i + 1;

            String upAction = ACTION_NAV_UP + currentIndex;
            String downAction = ACTION_NAV_DOWN + currentIndex;

            button.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("UP"), upAction);
            button.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("DOWN"), downAction);

            button.getActionMap().put(upAction, new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    if (previousIndex >= 0) {
                        menuButtons.get(previousIndex).requestFocusInWindow();
                    }
                }
            });
            button.getActionMap().put(downAction, new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    if (nextIndex < menuButtons.size()) {
                        menuButtons.get(nextIndex).requestFocusInWindow();
                    }
                }
            });
        }
    }

    private void featureSoon(String feature) {
        dialogService.info("Bientot disponible", feature + " sera disponible prochainement.");
        setStatus("Fonctionnalite \"" + feature + "\" en cours de developpement.");
    }

    private void openPresenceDialog() {
        if (!ensureAuthenticated()) {
            return;
        }
        Window window = SwingUtilities.getWindowAncestor(this);
        PresenceListDialog dialog = new PresenceListDialog(window, chatConnectionFactory, dialogService);
        dialog.setVisible(true);
        setStatus("Liste des connectes ouverte.");
    }

    private void openChat() {
        if (!ensureAuthenticated() || !ensureChatEnabled()) {
            return;
        }
        if (chatWindow == null || !chatWindow.isDisplayable()) {
            Window window = SwingUtilities.getWindowAncestor(this);
            chatWindow = new ChatWindow(window, chatConnectionFactory, settingsService, dialogService);
        }
        chatWindow.setVisible(true);
        chatWindow.toFront();
        setStatus("Tchat ouvert.");
    }

    private void openOptions() {
        Window window = SwingUtilities.getWindowAncestor(this);
        OptionsDialog dialog = new OptionsDialog(window, settingsService);
        dialog.setVisible(true);
        setStatus("Options mises a jour.");
    }

    private void logout() {
        session.clear();
        setStatus("Deconnecte.");
        if (screenManager != null) {
            SwingUtilities.invokeLater(() -> screenManager.show("home"));
        }
    }

    private boolean ensureAuthenticated() {
        if (session.authenticated().isPresent()) {
            return true;
        }
        dialogService.error("Authentification requise", "Veuillez vous reconnecter pour acceder a ce module.");
        if (screenManager != null) {
            SwingUtilities.invokeLater(() -> screenManager.show("home"));
        }
        return false;
    }

    private boolean ensureChatEnabled() {
        if (settingsService.current().chatEnabled()) {
            return true;
        }
        dialogService.info("Tchat desactive", "Activez le tchat dans les options pour l'utiliser.");
        return false;
    }

    private void setStatus(String text) {
        SwingUtilities.invokeLater(() -> statusLabel.setText(text));
    }

    @Override
    public String id() {
        return "main-menu";
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        setStatus("Pret.");
        SwingUtilities.invokeLater(() -> shelvesButton.requestFocusInWindow());
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
    }
}
