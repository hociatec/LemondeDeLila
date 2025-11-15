package com.lemondelila.client.application.view.home;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.ui.action.ActionManager;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.lifecycle.ShutdownManager;
import com.lemondelila.client.user.events.LoginRequested;
import com.lemondelila.client.user.events.RegistrationRequested;

import javax.swing.AbstractAction;
import javax.swing.KeyStroke;
import java.awt.event.ActionEvent;
import java.util.Objects;

final class HomeUiBindings {

    private final HomeView view;
    private final DialogService dialogService;
    private final DomainEventBus eventBus;
    private final ActionManager actionManager;
    private final AccessibleShortcutRegistry shortcutRegistry;
    private final ShutdownManager shutdownManager;
    private boolean initialized;

    HomeUiBindings(HomeView view,
                   DialogService dialogService,
                   DomainEventBus eventBus,
           ActionManager actionManager,
                   AccessibleShortcutRegistry shortcutRegistry,
                   ShutdownManager shutdownManager) {
        this.view = Objects.requireNonNull(view, "view");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.actionManager = Objects.requireNonNull(actionManager, "actionManager");
        this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
        this.shutdownManager = Objects.requireNonNull(shutdownManager, "shutdownManager");
    }

    AutoCloseable install(Runnable landingAction) {
        if (!initialized) {
            registerForms();
            registerLandingButtons();
            initialized = true;
        }
        return registerShortcuts(landingAction);
    }

    private void registerForms() {
        view.loginForm().onLogin(credentials -> {
            view.setStatus("Connexion en cours...");
            eventBus.publish(new LoginRequested(credentials.username(), credentials.password()));
        });

        view.registerForm().onRegister(data -> {
            view.setStatus("Inscription en cours...");
            eventBus.publish(new RegistrationRequested(data.username(), data.password(), data.email()));
        });
    }

    private void registerLandingButtons() {
        view.landingPanel().onLogin(view::showLogin);
        view.landingPanel().onRegister(view::showRegister);
        view.landingPanel().onQuit(() -> {
            dialogService.confirm("Quitter",
                    "Voulez-vous quitter l'application ?")
                    .thenAccept(confirmed -> {
                        if (Boolean.TRUE.equals(confirmed)) {
                            shutdownManager.requestExit();
                        }
                    });
        });
    }

    private AutoCloseable registerShortcuts(Runnable landingAction) {
        Objects.requireNonNull(landingAction, "landingAction");
        KeyStroke escapeKey = KeyStroke.getKeyStroke("ESCAPE");
        actionManager.register("home.show-landing", () -> new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                landingAction.run();
            }
        }, escapeKey);
        shortcutRegistry.register(escapeKey, "Retour accueil");
        AutoCloseable actionScope = actionManager.attachTo(view.component());
        AutoCloseable shortcutScope = shortcutRegistry.applyTo(view.component());
        return () -> {
            closeQuietly(actionScope);
            closeQuietly(shortcutScope);
        };
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
