package com.lemondelila.client.application.view.menu;

import com.lemondelila.client.application.view.home.HomeScreen;
import com.lemondelila.client.catalogue.controller.CatalogController;
import com.lemondelila.client.chat.controller.ChatController;
import com.lemondelila.client.presence.controller.PresenceController;
import com.lemondelila.client.social.controller.SocialController;
import com.lemondelila.client.settings.controller.OptionsController;
import com.lemondelila.client.user.events.UserLoggedOut;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;

import javax.swing.AbstractAction;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.util.List;

public final class MainMenuScreen extends JPanel implements Screen {

    public static final ScreenId ID = ScreenId.of("main-menu");

    private static final String ACTION_SHOW_CATALOG = "main-menu.show-catalog";
    private static final String ACTION_NAV_UP = "main-menu.nav-up.";
    private static final String ACTION_NAV_DOWN = "main-menu.nav-down.";
    private static final String ACTION_EXIT_MENU = "main-menu.exit";

    private final DialogService dialogService;
    private final ChatController chatController;
    private final PresenceController presenceController;
    private final SocialController socialController;
    private final OptionsController optionsController;
    private final CatalogController catalogController;
    private final ClientSession session;
    private final DomainEventBus eventBus;
    private final MainMenuAudio audio;
    private final MainMenuView view;

    private ScreenManager screenManager;

    @Inject
    public MainMenuScreen(DialogService dialogService,
                          ChatController chatController,
                          PresenceController presenceController,
                          SocialController socialController,
                          OptionsController optionsController,
                          CatalogController catalogController,
                          ClientSession session,
                          DomainEventBus eventBus,
                          SoundEffectManager sounds) {
        this.dialogService = dialogService;
        this.chatController = chatController;
        this.presenceController = presenceController;
        this.socialController = socialController;
        this.optionsController = optionsController;
        this.catalogController = catalogController;
        this.session = session;
        this.eventBus = eventBus;
        this.audio = new MainMenuAudio(sounds);
        this.view = new MainMenuView();

        setLayout(new BorderLayout());
        add(view.component(), BorderLayout.CENTER);

        registerHandlers();
        registerShortcuts();
        registerNavigation();
    }

    private void registerHandlers() {
        view.shelvesButton().addActionListener(e -> onMenuSelected(this::openCatalog));
        view.joinGameButton().addActionListener(e -> onMenuSelected(() -> featureSoon("Rejoindre une partie")));
        view.chatButton().addActionListener(e -> onMenuSelected(this::openChat));
        view.socialButton().addActionListener(e -> onMenuSelected(this::openSocial));
        view.optionsButton().addActionListener(e -> onMenuSelected(this::openOptions));
        view.logoutButton().addActionListener(e -> onMenuSelected(this::logout));
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
        List<JButton> buttons = view.orderedButtons();
        for (int i = 0; i < buttons.size(); i++) {
            JButton button = buttons.get(i);
            int previousIndex = i - 1;
            int nextIndex = i + 1;

            String upAction = ACTION_NAV_UP + i;
            String downAction = ACTION_NAV_DOWN + i;

            button.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("UP"), upAction);
            button.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("DOWN"), downAction);

            button.getActionMap().put(upAction, new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    if (previousIndex >= 0) {
                        audio.playNavigate();
                        buttons.get(previousIndex).requestFocusInWindow();
                    }
                }
            });
            button.getActionMap().put(downAction, new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    if (nextIndex < buttons.size()) {
                        audio.playNavigate();
                        buttons.get(nextIndex).requestFocusInWindow();
                    }
                }
            });
        }
    }

    private void handleEscape() {
        if (session.authenticated().isPresent()) {
            setStatus("Appuyez sur \"Deconnexion\" pour quitter votre session.");
            return;
        }
        audio.playSelect();
        if (screenManager != null) {
            SwingUtilities.invokeLater(() -> screenManager.show(HomeScreen.ID));
        }
    }

    private void onMenuSelected(Runnable action) {
        audio.playSelect();
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
        audio.playSelect();
        applyResult(presenceController.open(this));
    }

    private void openChat() {
        if (!ensureAuthenticated()) {
            return;
        }
        audio.playSelect();
        applyResult(chatController.open(SwingUtilities.getWindowAncestor(this)));
    }

    private void openSocial() {
        if (!ensureAuthenticated()) {
            return;
        }
        audio.playSelect();
        applyResult(socialController.open(SwingUtilities.getWindowAncestor(this)));
    }

    private void openOptions() {
        applyResult(optionsController.open(SwingUtilities.getWindowAncestor(this)));
    }

    private void openCatalog() {
        if (!ensureAuthenticated()) {
            return;
        }
        audio.playSelect();
        applyResult(catalogController.openCatalog());
    }

    private void logout() {
        String username = session.authenticated().map(ClientSession.AuthState::username).orElse(null);
        session.clear();
        eventBus.publish(new UserLoggedOut(username));
        audio.playSelect();
        setStatus("Deconnecte.");
        if (screenManager != null) {
            SwingUtilities.invokeLater(() -> screenManager.show(HomeScreen.ID));
        }
    }

    private boolean ensureAuthenticated() {
        if (session.authenticated().isPresent()) {
            return true;
        }
        dialogService.error("Authentification requise", "Veuillez vous reconnecter pour acceder a ce module.");
        if (screenManager != null) {
            SwingUtilities.invokeLater(() -> screenManager.show(HomeScreen.ID));
        }
        return false;
    }

    private void setStatus(String text) {
        SwingUtilities.invokeLater(() -> view.setStatus(text));
    }

    private void applyResult(ControllerResult result) {
        if (result == null) {
            return;
        }
        result.statusMessage().ifPresent(this::setStatus);
        result.navigationTarget().ifPresent(target -> {
            if (screenManager != null) {
                SwingUtilities.invokeLater(() -> screenManager.show(target));
            }
        });
    }

    @Override
    public ScreenId id() {
        return ID;
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        setStatus("Pret.");
        audio.playAppLaunch();
        audio.startBackground();
        SwingUtilities.invokeLater(view::focusFirstButton);
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        audio.stopBackground();
    }
}
