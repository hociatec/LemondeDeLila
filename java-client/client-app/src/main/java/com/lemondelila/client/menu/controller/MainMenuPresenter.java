package com.lemondelila.client.menu.controller;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.chat.controller.ChatController;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.catalog.controller.GameCatalogController;
import com.lemondelila.client.game.room.browser.controller.RoomBrowserController;
import com.lemondelila.client.game.room.event.RoomInviteReceived;
import com.lemondelila.client.home.view.HomeScreen;
import com.lemondelila.client.admin.controller.AdminController;
import com.lemondelila.client.menu.view.MainMenuView;
import com.lemondelila.client.presence.controller.PresenceController;
import com.lemondelila.client.presence.service.PresenceActivityReporter;
import com.lemondelila.client.social.view.SocialScreen;
import com.lemondelila.client.settings.controller.OptionsController;
import com.lemondelila.client.user.events.UserLoggedOut;
import com.lemondelila.client.user.model.ClientSession;

import javax.swing.AbstractAction;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.event.ActionEvent;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

public final class MainMenuPresenter {

    private final DialogService dialogService;
    private final ChatController chatController;
    private final PresenceController presenceController;
    private final OptionsController optionsController;
    private final GameCatalogController catalogController;
    private final RoomBrowserController roomBrowserController;
    private final AdminController adminController;
    private final ClientSession session;
    private final DomainEventBus eventBus;
    private final EventSubscriptions subscriptions = new EventSubscriptions();
    private final MainMenuAudio audio;
    private final MainMenuView view;
    private final PresenceActivityReporter presenceReporter;
    private JComponent root;
    private ScreenManager screenManager;
    private boolean catalogPrefetched;
    private AutoCloseable presenceHandle;

    public MainMenuPresenter(DialogService dialogService,
                             ChatController chatController,
                             PresenceController presenceController,
                             OptionsController optionsController,
                             GameCatalogController catalogController,
                             RoomBrowserController roomBrowserController,
                             AdminController adminController,
                             ClientSession session,
                             DomainEventBus eventBus,
                             MainMenuAudio audio,
                             MainMenuView view,
                             PresenceActivityReporter presenceReporter) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.chatController = Objects.requireNonNull(chatController, "chatController");
        this.presenceController = Objects.requireNonNull(presenceController, "presenceController");
        this.optionsController = Objects.requireNonNull(optionsController, "optionsController");
        this.catalogController = Objects.requireNonNull(catalogController, "catalogController");
        this.roomBrowserController = Objects.requireNonNull(roomBrowserController, "roomBrowserController");
        this.adminController = Objects.requireNonNull(adminController, "adminController");
        this.session = Objects.requireNonNull(session, "session");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.audio = Objects.requireNonNull(audio, "audio");
        this.view = Objects.requireNonNull(view, "view");
        this.presenceReporter = Objects.requireNonNull(presenceReporter, "presenceReporter");
        registerHandlers();
        registerNavigation();
        subscriptions.subscribe(eventBus, RoomInviteReceived.class, this::onInviteReceived);
    }

    public void onShow(ScreenManager manager) {
        this.screenManager = manager;
        attachPresenceState();
        setStatus(Internationalization.text("mainmenu.status.ready"));
        refreshAdminVisibility();
        if (!catalogPrefetched && session.authenticated().isPresent()) {
            catalogController.fetchAll();
            catalogPrefetched = true;
        }
        audio.playAppLaunch();
        audio.startBackground();
        SwingUtilities.invokeLater(view::focusFirstButton);
    }

    public void onHide() {
        this.screenManager = null;
        audio.stopBackground();
        releasePresenceState();
    }

    private void registerHandlers() {
        view.shelvesButton().addActionListener(e -> onMenuSelected(this::openCatalog));
        view.joinGameButton().addActionListener(e -> onMenuSelected(this::openRoomBrowser));
        view.chatButton().addActionListener(e -> onMenuSelected(this::openChat));
        view.socialButton().addActionListener(e -> onMenuSelected(this::openSocialCenter));
        view.adminButton().addActionListener(e -> onMenuSelected(this::openAdmin));
        view.optionsButton().addActionListener(e -> onMenuSelected(this::openOptions));
        view.logoutButton().addActionListener(e -> onMenuSelected(this::logout));
    }

    public void attachRoot(JComponent root) {
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
            final int index = i;
            button.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("UP"), "main-menu.nav-up." + i);
            button.getActionMap().put("main-menu.nav-up." + i, new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    focusSibling(buttons, index, -1);
                }
            });
            button.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("DOWN"), "main-menu.nav-down." + i);
            button.getActionMap().put("main-menu.nav-down." + i, new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    focusSibling(buttons, index, 1);
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

    private void openRoomBrowser() {
        if (!ensureAuthenticated()) {
            return;
        }
        applyResult(roomBrowserController.openBrowser());
    }

    private void openChat() {
        if (!ensureAuthenticated()) {
            return;
        }
        audio.playSelect();
        applyResult(chatController.open(SwingUtilities.getWindowAncestor(root)));
    }

    private void openSocialCenter() {
        if (!ensureAuthenticated()) {
            return;
        }
        showScreen(SocialScreen.ID);
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

    private void onInviteReceived(RoomInviteReceived event) {
        if (event == null || event.invite() == null) {
            return;
        }
        if (!ensureAuthenticated()) {
            return;
        }
        String title = "Invitation de table";
        String body = "Invitation de " + event.invite().fromUsername() + " pour rejoindre \"" + event.invite().roomName() + "\".\nAccepter ?";
        dialogService.confirm(title, body).thenAccept(accept -> {
            if (accept != null && accept) {
                ControllerResult result = roomBrowserController.acceptInviteAndOpenTable(event.invite().invitationId());
                applyResult(result);
            } else {
                roomBrowserController.refuseInvite(event.invite().invitationId());
            }
        });
    }

    private void openAdmin() {
        if (!ensureAuthenticated()) {
            return;
        }
        if (!hasAdminRole()) {
            dialogService.error(
                    Internationalization.text("mainmenu.auth.required.title"),
                    "Accès admin refusé (rôle manquant).");
            setStatus("Rôle administrateur requis.");
            return;
        }
        audio.playSelect();
        applyResult(adminController.open(SwingUtilities.getWindowAncestor(root)));
    }

    private void logout() {
        String username = session.authenticated().map(ClientSession.AuthState::username).orElse(null);
        session.clear();
        catalogPrefetched = false;
        eventBus.publish(new UserLoggedOut(username));
        audio.playSelect();
        setStatus(Internationalization.text("mainmenu.status.loggedout"));
        refreshAdminVisibility();
        showScreen(HomeScreen.ID);
        attachPresenceState();
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

    private void refreshAdminVisibility() {
        boolean showAdmin = hasAdminRole();
        view.setAdminVisible(showAdmin);
    }

    private boolean hasAdminRole() {
        String token = session.authenticated().map(ClientSession.AuthState::token).orElse(null);
        if (token == null || token.isBlank()) {
            return false;
        }
        String[] parts = token.split("\\.");
        if (parts.length < 2) {
            return false;
        }
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(parts[1]);
            ObjectMapper mapper = new ObjectMapper();
            JsonNode payload = mapper.readTree(decoded);
            JsonNode rolesNode = payload.path("roles");
            if (rolesNode.isArray()) {
                for (JsonNode role : rolesNode) {
                    String r = role.asText("");
                    if ("ROLE_ADMIN".equalsIgnoreCase(r) || "admin".equalsIgnoreCase(r)) {
                        return true;
                    }
                }
            }
        } catch (Exception ignored) {
            return false;
        }
        return false;
    }

    private void setStatus(String text) {
        SwingUtilities.invokeLater(() -> view.setStatus(text));
    }

    private void focusSibling(List<JButton> buttons, int currentIndex, int delta) {
        int nextIndex = currentIndex + delta;
        while (nextIndex >= 0 && nextIndex < buttons.size()) {
            JButton candidate = buttons.get(nextIndex);
            if (candidate.isVisible() && candidate.isEnabled()) {
                audio.playNavigate();
                candidate.requestFocusInWindow();
                return;
            }
            nextIndex += delta;
        }
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
        Runnable task = () -> {
            screenManager.show(id);
            if (root != null) {
                java.awt.Window window = SwingUtilities.getWindowAncestor(root);
                if (window != null) {
                    window.requestFocus();
                    window.toFront();
                }
            }
        };
        if (SwingUtilities.isEventDispatchThread()) {
            task.run();
        } else {
            SwingUtilities.invokeLater(task);
        }
    }
    private void attachPresenceState() {
        releasePresenceState();
        presenceHandle = presenceReporter.enterHome();
    }

    private void releasePresenceState() {
        if (presenceHandle == null) {
            return;
        }
        try {
            presenceHandle.close();
        } catch (Exception ignored) {
        } finally {
            presenceHandle = null;
        }
    }
}
