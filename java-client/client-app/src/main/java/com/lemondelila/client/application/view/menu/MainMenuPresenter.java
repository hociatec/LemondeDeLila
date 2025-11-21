package com.lemondelila.client.application.view.menu;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.application.view.home.HomeScreen;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.catalog.controller.GameCatalogController;
import com.lemondelila.client.chat.controller.ChatController;
import com.lemondelila.client.settings.controller.OptionsController;
import com.lemondelila.client.presence.controller.PresenceController;
import com.lemondelila.client.social.controller.SocialController;
import com.lemondelila.client.user.events.UserLoggedOut;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.framework.core.event.DomainEventBus;

import javax.swing.AbstractAction;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.event.ActionEvent;
import java.util.List;
import java.util.Objects;

final class MainMenuPresenter {

    private final DialogService dialogService;
    private final ChatController chatController;
    private final PresenceController presenceController;
    private final SocialController socialController;
    private final OptionsController optionsController;
    private final GameCatalogController catalogController;
    private final ClientSession session;
    private final DomainEventBus eventBus;
    private final MainMenuAudio audio;
    private final MainMenuView view;
    private JComponent root;
    private ScreenManager screenManager;

    MainMenuPresenter(DialogService dialogService,
                      ChatController chatController,
                      PresenceController presenceController,
                      SocialController socialController,
                      OptionsController optionsController,
                      GameCatalogController catalogController,
                      ClientSession session,
                      DomainEventBus eventBus,
                      MainMenuAudio audio,
                      MainMenuView view) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.chatController = Objects.requireNonNull(chatController, "chatController");
        this.presenceController = Objects.requireNonNull(presenceController, "presenceController");
        this.socialController = Objects.requireNonNull(socialController, "socialController");
        this.optionsController = Objects.requireNonNull(optionsController, "optionsController");
        this.catalogController = Objects.requireNonNull(catalogController, "catalogController");
        this.session = Objects.requireNonNull(session, "session");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.audio = Objects.requireNonNull(audio, "audio");
        this.view = Objects.requireNonNull(view, "view");
        registerHandlers();
        registerNavigation();
    }

    void onShow(ScreenManager manager) {
        this.screenManager = manager;
        setStatus(Internationalization.text("mainmenu.status.ready"));
        audio.playAppLaunch();
        audio.startBackground();
        SwingUtilities.invokeLater(view::focusFirstButton);
    }

    void onHide() {
        this.screenManager = null;
        audio.stopBackground();
    }

    private void registerHandlers() {
        view.shelvesButton().addActionListener(e -> onMenuSelected(this::openCatalog));
        view.joinGameButton().addActionListener(e -> onMenuSelected(this::openPresenceDialog));
        view.chatButton().addActionListener(e -> onMenuSelected(this::openChat));
        view.socialButton().addActionListener(e -> onMenuSelected(this::openSocial));
        view.optionsButton().addActionListener(e -> onMenuSelected(this::openOptions));
        view.logoutButton().addActionListener(e -> onMenuSelected(this::logout));
    }

    void attachRoot(JComponent root) {
        this.root = Objects.requireNonNull(root, "root");
        registerShortcuts();
    }

    private void registerShortcuts() {
        root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("alt G"), "main-menu.show-catalog");
        root.getActionMap().put("main-menu.show-catalog", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                onMenuSelected(MainMenuPresenter.this::openCatalog);
            }
        });
    }

    private void registerNavigation() {
        List<JButton> buttons = view.orderedButtons();
        for (int i = 0; i < buttons.size(); i++) {
            JButton button = buttons.get(i);
            int previousIndex = i - 1;
            int nextIndex = i + 1;
            button.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("UP"), "main-menu.nav-up." + i);
            button.getActionMap().put("main-menu.nav-up." + i, new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    if (previousIndex >= 0) {
                        audio.playNavigate();
                        buttons.get(previousIndex).requestFocusInWindow();
                    }
                }
            });
            button.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("DOWN"), "main-menu.nav-down." + i);
            button.getActionMap().put("main-menu.nav-down." + i, new AbstractAction() {
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
        // Echap inactif sur le menu principal (pas d'action).
    }

    private void onMenuSelected(Runnable action) {
        audio.playSelect();
        action.run();
    }

    private void featureSoon(String feature) {
        dialogService.info(
                Internationalization.text("mainmenu.feature.soon.title"),
                Internationalization.text("mainmenu.feature.soon.body", feature));
        setStatus(Internationalization.text("mainmenu.feature.soon.status", feature));
    }

    private void openPresenceDialog() {
        if (!ensureAuthenticated()) {
            return;
        }
        audio.playSelect();
        applyResult(presenceController.open(root));
    }

    private void openChat() {
        if (!ensureAuthenticated()) {
            return;
        }
        audio.playSelect();
        applyResult(chatController.open(SwingUtilities.getWindowAncestor(root)));
    }

    private void openSocial() {
        if (!ensureAuthenticated()) {
            return;
        }
        audio.playSelect();
        applyResult(socialController.open(SwingUtilities.getWindowAncestor(root)));
    }

    private void openOptions() {
        audio.playSelect();
        applyResult(optionsController.open(SwingUtilities.getWindowAncestor(root)));
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
        setStatus(Internationalization.text("mainmenu.status.loggedout"));
        showScreen(HomeScreen.ID);
    }

    private boolean ensureAuthenticated() {
        if (session.authenticated().isPresent()) {
            return true;
        }
        dialogService.error(
                Internationalization.text("mainmenu.auth.required.title"),
                Internationalization.text("mainmenu.auth.required.body"));
        showScreen(HomeScreen.ID);
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
        result.navigationTarget().ifPresent(this::showScreen);
    }

    private void showScreen(ScreenId id) {
        if (id == null || screenManager == null) {
            return;
        }
        SwingUtilities.invokeLater(() -> screenManager.show(id));
    }
}
