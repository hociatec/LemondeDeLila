package com.lemondelila.client.application.view.menu;

import com.lemondelila.client.catalogue.controller.CatalogController;
import com.lemondelila.client.chat.controller.ChatController;
import com.lemondelila.client.presence.controller.PresenceController;
import com.lemondelila.client.settings.controller.OptionsController;
import com.lemondelila.client.user.events.UserLoggedOut;
import com.lemondelila.client.media.SoundBank;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.framework.ui.util.ButtonUtils;

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
import java.awt.event.ActionEvent;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.util.ArrayList;
import java.util.List;

public final class MainMenuScreen extends JPanel implements Screen {

    private static final String ACTION_SHOW_CATALOG = "main-menu.show-catalog";
    private static final String ACTION_NAV_UP = "main-menu.nav-up.";
    private static final String ACTION_NAV_DOWN = "main-menu.nav-down.";
    private static final String ACTION_EXIT_MENU = "main-menu.exit";

    private final DialogService dialogService;
    private final ChatController chatController;
    private final PresenceController presenceController;
    private final OptionsController optionsController;
    private final CatalogController catalogController;
    private final ClientSession session;
    private final DomainEventBus eventBus;
    private final SoundEffectManager sounds;

    private final JLabel statusLabel = new JLabel(" ");
    private final JButton shelvesButton = new JButton("Etageres");
    private final JButton joinGameButton = new JButton("Rejoindre une partie");
    private final JButton chatButton = new JButton("Tchat");
    private final JButton optionsButton = new JButton("Options");
    private final JButton logoutButton = new JButton("Se deconnecter");

    private final List<JButton> menuButtons = new ArrayList<>();

    private ScreenManager screenManager;
    @Inject
    public MainMenuScreen(DialogService dialogService,
                          ChatController chatController,
                          PresenceController presenceController,
                          OptionsController optionsController,
                          CatalogController catalogController,
                          ClientSession session,
                          DomainEventBus eventBus,
                          SoundEffectManager sounds) {
        this.dialogService = dialogService;
        this.chatController = chatController;
        this.presenceController = presenceController;
        this.optionsController = optionsController;
        this.catalogController = catalogController;
        this.session = session;
        this.eventBus = eventBus;
        this.sounds = sounds;
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
        button.addFocusListener(new FocusAdapter() {
            @Override
            public void focusGained(FocusEvent e) {
                statusLabel.setText("Sélection : " + button.getText());
                playNavigate();
            }
        });
        menuButtons.add(button);
        add(button);
    }

    private void addSpacer() {
        add(Box.createRigidArea(new Dimension(0, 12)));
    }

    private void registerHandlers() {
        shelvesButton.addActionListener(e -> onMenuSelected(this::openCatalog));
        joinGameButton.addActionListener(e -> onMenuSelected(() -> featureSoon("Rejoindre une partie")));
        chatButton.addActionListener(e -> onMenuSelected(this::openChat));
        optionsButton.addActionListener(e -> onMenuSelected(this::openOptions));
        logoutButton.addActionListener(e -> onMenuSelected(this::logout));
    }

    private void registerShortcuts() {
        getInputMap(WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("alt G"), ACTION_SHOW_CATALOG);
        getActionMap().put(ACTION_SHOW_CATALOG, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                onMenuSelected(MainMenuScreen.this::openCatalog);
            }
        });
        getInputMap(WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("ESCAPE"), ACTION_EXIT_MENU);
        getActionMap().put(ACTION_EXIT_MENU, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                handleEscape();
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

    private void handleEscape() {
        playSelect();
        if (screenManager != null) {
            SwingUtilities.invokeLater(() -> screenManager.show("home"));
        }
    }

    private void onMenuSelected(Runnable action) {
        playSelect();
        action.run();
    }

    private void featureSoon(String feature) {
        dialogService.info("Bientot disponible", feature + " sera disponible prochainement.");
        setStatus("Fonctionnalite \"" + feature + "\" en cours de developpement.");
    }

    private void openPresenceDialog() {
        if (!ensureAuthenticated()) {
            return;
        }
        playSelect();
        String status = presenceController.open(this);
        setStatus(status);
    }

    private void openChat() {
        if (!ensureAuthenticated()) {
            return;
        }
        playSelect();
        String status = chatController.open(SwingUtilities.getWindowAncestor(this));
        setStatus(status);
    }

    private void openOptions() {
        String status = optionsController.open(SwingUtilities.getWindowAncestor(this));
        setStatus(status);
    }

    private void openCatalog() {
        if (!ensureAuthenticated()) {
            return;
        }
        playSelect();
        String status = catalogController.openCatalog();
        setStatus(status);
    }

    private void logout() {
        String username = session.authenticated().map(ClientSession.AuthState::username).orElse(null);
        session.clear();
        eventBus.publish(new UserLoggedOut(username));
        playSelect();
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
        catalogController.attach(screenManager);
        setStatus("Pret.");
        playAppLaunch();
        startBackground();
        SwingUtilities.invokeLater(() -> shelvesButton.requestFocusInWindow());
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        catalogController.detach();
        stopBackground();
    }

    private void playAppLaunch() {
        if (sounds != null) {
            sounds.play(SoundBank.APP_LAUNCH);
        }
    }

    private void startBackground() {
        if (sounds != null) {
            sounds.play(SoundBank.BACKGROUND_FON);
        }
    }

    private void stopBackground() {
        if (sounds != null) {
            sounds.stop(SoundBank.BACKGROUND_FON);
        }
    }

    private void playNavigate() {
        if (sounds != null) {
            sounds.play(SoundBank.MENU_NAVIGATE);
        }
    }

    private void playSelect() {
        if (sounds != null) {
            sounds.play(SoundBank.MENU_SELECT);
        }
    }
}






