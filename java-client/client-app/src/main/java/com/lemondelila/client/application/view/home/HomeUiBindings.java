package com.lemondelila.client.application.view.home;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.ui.action.ActionManager;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.lifecycle.ApplicationLifecycle;
import com.lemondelila.client.user.events.LoginRequested;
import com.lemondelila.client.user.events.RegistrationRequested;
import com.lemondelila.client.user.view.LoginFormPanel;
import com.lemondelila.client.user.view.RegisterFormPanel;

import javax.swing.AbstractAction;
import javax.swing.KeyStroke;
import java.awt.event.ActionEvent;
import java.util.regex.Pattern;
import java.util.Objects;

final class HomeUiBindings {

    private static final Pattern SIMPLE_EMAIL =
            Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final HomeView view;
    private final DialogService dialogService;
    private final DomainEventBus eventBus;
    private final ActionManager actionManager;
    private final AccessibleShortcutRegistry shortcutRegistry;
    private final ApplicationLifecycle applicationLifecycle;
    private boolean initialized;

    HomeUiBindings(HomeView view,
                   DialogService dialogService,
                   DomainEventBus eventBus,
           ActionManager actionManager,
                   AccessibleShortcutRegistry shortcutRegistry,
                   ApplicationLifecycle applicationLifecycle) {
        this.view = Objects.requireNonNull(view, "view");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.actionManager = Objects.requireNonNull(actionManager, "actionManager");
        this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
        this.applicationLifecycle = Objects.requireNonNull(applicationLifecycle, "applicationLifecycle");
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
            if (!validateLogin(credentials)) {
                return;
            }
            view.setStatus("Connexion en cours...");
            eventBus.publish(new LoginRequested(credentials.username(), credentials.password()));
        });
        view.loginForm().onBack(() -> {
            view.showLanding();
            view.setStatus("");
        });

        view.registerForm().onRegister(data -> {
            if (!validateRegistration(data)) {
                return;
            }
            view.setStatus("Inscription en cours...");
            eventBus.publish(new RegistrationRequested(data.username(), data.password(), data.email()));
        });
        view.registerForm().onBack(() -> {
            view.showLanding();
            view.setStatus("");
        });
    }

    private boolean validateLogin(LoginFormPanel.LoginCredentials credentials) {
        String username = credentials.username();
        char[] password = credentials.password();
        if (username == null || username.isBlank()) {
            view.setStatus("Merci de saisir votre identifiant.");
            view.loginForm().focusDefaultField();
            return false;
        }
        if (password == null || password.length == 0) {
            view.setStatus("Merci de saisir votre mot de passe.");
            view.loginForm().focusDefaultField();
            return false;
        }
        return true;
    }

    private boolean validateRegistration(RegisterFormPanel.RegistrationData data) {
        String username = data.username();
        String email = data.email();
        char[] password = data.password();
        if (username == null || username.isBlank()) {
            view.setStatus("Merci d'indiquer un nom d'utilisateur.");
            view.registerForm().focusDefaultField();
            return false;
        }
        if (email == null || email.isBlank() || !SIMPLE_EMAIL.matcher(email).matches()) {
            view.setStatus("Adresse e-mail invalide.");
            view.registerForm().focusDefaultField();
            return false;
        }
        if (password == null || password.length < 6) {
            view.setStatus("Le mot de passe doit contenir au moins 6 caractères.");
            view.registerForm().focusDefaultField();
            return false;
        }
        return true;
    }

    private void registerLandingButtons() {
        view.landingPanel().onLogin(view::showLogin);
        view.landingPanel().onRegister(view::showRegister);
        view.landingPanel().onQuit(() ->
                applicationLifecycle.requestExitWithConfirmation(
                        "Quitter",
                        "Voulez-vous quitter l'application ?"
                ));
    }

    private AutoCloseable registerShortcuts(Runnable landingAction) {
        Objects.requireNonNull(landingAction, "landingAction");
        KeyStroke escapeKey = KeyStroke.getKeyStroke("ESCAPE");
        AutoCloseable actionRegistryScope = actionManager.openScope();
        AutoCloseable shortcutRegistryScope = shortcutRegistry.openScope();
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
            closeQuietly(actionRegistryScope);
            closeQuietly(shortcutRegistryScope);
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
