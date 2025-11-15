package com.lemondelila.client.application.view.home;

import com.lemondelila.client.application.AppBranding;
import com.lemondelila.client.application.view.menu.MainMenuScreen;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.ui.action.ActionManager;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.lifecycle.ShutdownManager;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.user.events.LoginFailed;
import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.events.RegistrationFailed;
import com.lemondelila.client.user.events.RegistrationSucceeded;
import com.lemondelila.client.user.model.ClientSession;

import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.util.function.Supplier;

public final class HomeScreen extends JPanel implements Screen, HomeEventCoordinator.Listener {

    public static final ScreenId ID = ScreenId.of("home");

    private final DomainEventBus eventBus;
    private final DialogService dialogService;
    private final HomeView view;
    private final HomeEventCoordinator eventCoordinator;
    private final HomeUiBindings uiBindings;
    private final HomeScreenLifecycle lifecycle;
    private AutoCloseable shortcutScope;

    private ScreenManager screenManager;

    @Inject
    public HomeScreen(DomainEventBus eventBus,
                      ActionManager actionManager,
                      AccessibleShortcutRegistry shortcutRegistry,
                      FocusHighlighter focusHighlighter,
                      DialogService dialogService,
                      ApplicationContext context,
                      AppBranding branding) {
        this(eventBus, actionManager, shortcutRegistry, focusHighlighter, dialogService,
                () -> context.get(com.lemondelila.client.framework.access.NarrationQueue.class),
                branding, context.get(ClientSession.class),
                context.get(AppSettingsService.class),
                context.get(ShutdownManager.class));
    }

    HomeScreen(DomainEventBus eventBus,
               ActionManager actionManager,
               AccessibleShortcutRegistry shortcutRegistry,
               FocusHighlighter focusHighlighter,
               DialogService dialogService,
               Supplier<com.lemondelila.client.framework.access.NarrationQueue> narrationQueueSupplier,
               AppBranding branding,
               ClientSession session,
               AppSettingsService settingsService,
               ShutdownManager shutdownManager) {
        this.eventBus = eventBus;
        this.dialogService = dialogService;
        this.view = new HomeView(focusHighlighter, branding);
        this.eventCoordinator = new HomeEventCoordinator(eventBus);
        this.uiBindings = new HomeUiBindings(view, dialogService, eventBus, actionManager, shortcutRegistry, shutdownManager);
        this.lifecycle = new HomeScreenLifecycle(eventCoordinator, narrationQueueSupplier, settingsService, session, eventBus);
        setLayout(new BorderLayout());
        add(view.component(), BorderLayout.CENTER);
    }

    private void showLanding() {
        view.showLanding();
        view.setStatus(" ");
    }

    private void updateStatus(String text) {
        view.setStatus(text);
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
        closeQuietly(shortcutScope);
        shortcutScope = uiBindings.install(this::showLanding);
        lifecycle.onShow(this, view, this);
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        closeQuietly(shortcutScope);
        shortcutScope = null;
        lifecycle.onHide();
    }

    @Override
    public void onLoginSuccess(LoginSucceeded event) {
        updateStatus("Bienvenue " + event.username() + "!");
        if (screenManager != null) {
            SwingUtilities.invokeLater(() -> screenManager.show(MainMenuScreen.ID));
        }
    }

    @Override
    public void onLoginFailure(LoginFailed event) {
        updateStatus(event.reason());
        dialogService.error("Connexion impossible", event.reason());
        SwingUtilities.invokeLater(() -> view.loginForm().focusDefaultField());
    }

    @Override
    public void onRegistrationSuccess(RegistrationSucceeded event) {
        updateStatus("Inscription reussie ! Vous pouvez vous connecter.");
        dialogService.info("Inscription reussie",
                "Bienvenue " + event.username() + " ! Connectez-vous pour continuer.");
        view.showLogin();
    }

    @Override
    public void onRegistrationFailure(RegistrationFailed event) {
        updateStatus(event.reason());
        dialogService.error("Inscription impossible", event.reason());
        SwingUtilities.invokeLater(() -> view.registerForm().focusDefaultField());
    }

    private static void closeQuietly(AutoCloseable closeable) {
        if (closeable == null) {
            return;
        }
        try {
            closeable.close();
        } catch (Exception ignored) {
        }
    }
}
