package com.lemondelila.client.application.view.home;

import com.lemondelila.client.application.AppBranding;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.ui.action.ActionManager;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.user.events.LoginFailed;
import com.lemondelila.client.user.events.LoginRequested;
import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.events.RegistrationFailed;
import com.lemondelila.client.user.events.RegistrationRequested;
import com.lemondelila.client.user.events.RegistrationSucceeded;
import com.lemondelila.client.user.model.ClientSession;

import javax.swing.AbstractAction;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.util.function.Supplier;

public final class HomeScreen extends JPanel implements Screen, HomeEventCoordinator.Listener {

    private final DomainEventBus eventBus;
    private final ActionManager actionManager;
    private final AccessibleShortcutRegistry shortcutRegistry;
    private final DialogService dialogService;
    private final Supplier<NarrationQueue> narrationQueueSupplier;
    private final HomeView view;
    private final HomeEventCoordinator eventCoordinator;
    private final ClientSession session;
    private final AppSettingsService settingsService;

    private volatile NarrationQueue narrationQueue;
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
                () -> context.get(NarrationQueue.class), branding, context.get(ClientSession.class),
                context.get(AppSettingsService.class));
    }

    HomeScreen(DomainEventBus eventBus,
               ActionManager actionManager,
               AccessibleShortcutRegistry shortcutRegistry,
               FocusHighlighter focusHighlighter,
               DialogService dialogService,
               Supplier<NarrationQueue> narrationQueueSupplier,
               AppBranding branding,
               ClientSession session,
               AppSettingsService settingsService) {
        this.eventBus = eventBus;
        this.actionManager = actionManager;
        this.shortcutRegistry = shortcutRegistry;
        this.dialogService = dialogService;
        this.narrationQueueSupplier = narrationQueueSupplier;
        this.view = new HomeView(focusHighlighter, branding);
        this.eventCoordinator = new HomeEventCoordinator(eventBus);
        this.session = session;
        this.settingsService = settingsService;

        setLayout(new BorderLayout());
        add(view.component(), BorderLayout.CENTER);

        registerUiHandlers();
        registerShortcuts();
    }

    private void registerUiHandlers() {
        view.loginForm().onLogin(credentials -> {
            view.setStatus("Connexion en cours...");
            eventBus.publish(new LoginRequested(credentials.username(), credentials.password()));
        });

        view.registerForm().onRegister(data -> {
            view.setStatus("Inscription en cours...");
            eventBus.publish(new RegistrationRequested(data.username(), data.password(), data.email()));
        });

        view.landingPanel().onLogin(view::showLogin);
        view.landingPanel().onRegister(view::showRegister);
        view.landingPanel().onQuit(() -> {
            boolean confirmed = dialogService.confirm("Quitter",
                    "Voulez-vous quitter l'application ?").join();
            if (confirmed) {
                System.exit(0);
            }
        });
    }

    private void registerShortcuts() {
        KeyStroke escapeKey = KeyStroke.getKeyStroke("ESCAPE");
        actionManager.register("home.show-landing", () -> new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                showLanding();
            }
        }, escapeKey);
        shortcutRegistry.register(escapeKey, "Retour accueil");
        actionManager.attachTo(this);
        shortcutRegistry.applyTo(this);
    }

    private void showLanding() {
        view.showLanding();
        view.setStatus(" ");
    }

    private void updateStatus(String text) {
        view.setStatus(text);
    }

    @Override
    public String id() {
        return "home";
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        this.narrationQueue = narrationQueueSupplier.get();
        eventCoordinator.subscribe(this);
        view.showLanding();
        boolean autoLogin = settingsService.current().stayConnected() && session.authenticated().isPresent();
        if (autoLogin) {
            session.authenticated().ifPresent(auth -> eventBus.publish(new LoginSucceeded(auth.username(), auth.token())));
        } else if (narrationQueue != null) {
            narrationQueue.enqueue(this, "Ecran d'accueil, utilisez les fleches pour naviguer.");
        }
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        eventCoordinator.unsubscribe();
    }

    @Override
    public void onLoginSuccess(LoginSucceeded event) {
        updateStatus("Bienvenue " + event.username() + "!");
        if (screenManager != null) {
            SwingUtilities.invokeLater(() -> screenManager.show("main-menu"));
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
}
