package com.lemondelila.client.home.controller;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.menu.view.MainMenuScreen;
import com.lemondelila.client.home.view.HomeView;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.user.events.LoginFailed;
import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.events.RegistrationFailed;
import com.lemondelila.client.user.events.RegistrationSucceeded;

import javax.swing.SwingUtilities;
import java.util.Objects;

public final class HomePresenter implements HomeEventCoordinator.Listener {

    private final HomeView view;
    private final DialogService dialogService;
    private final HomeUiBindings uiBindings;
    private final HomeScreenLifecycle lifecycle;

    private ScreenManager screenManager;
    private AutoCloseable shortcutScope;

    public HomePresenter(HomeView view,
                         DialogService dialogService,
                         HomeUiBindings uiBindings,
                         HomeScreenLifecycle lifecycle) {
        this.view = Objects.requireNonNull(view, "view");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.uiBindings = Objects.requireNonNull(uiBindings, "uiBindings");
        this.lifecycle = Objects.requireNonNull(lifecycle, "lifecycle");
    }

    public void onShow(ScreenManager manager, Screen narrationTarget) {
        this.screenManager = manager;
        closeShortcuts();
        shortcutScope = uiBindings.install(this::showLanding);
        lifecycle.onShow(this, view, narrationTarget);
    }

    public void onHide() {
        lifecycle.onHide();
        closeShortcuts();
        screenManager = null;
    }

    @Override
    public void onLoginSuccess(LoginSucceeded event) {
        view.setStatus(Internationalization.text("home.login.success", event.username()));
        ScreenManager manager = this.screenManager;
        if (manager != null) {
            SwingUtilities.invokeLater(() -> manager.show(MainMenuScreen.ID));
        }
    }

    @Override
    public void onLoginFailure(LoginFailed event) {
        view.setStatus(event.reason());
        dialogService.error(Internationalization.text("home.login.error.title"),
                Internationalization.text("home.login.error.body", event.reason()));
        SwingUtilities.invokeLater(() -> view.loginForm().focusDefaultField());
    }

    @Override
    public void onRegistrationSuccess(RegistrationSucceeded event) {
        view.setStatus(Internationalization.text("home.register.success.status"));
        dialogService.info(Internationalization.text("home.register.success.title"),
                Internationalization.text("home.register.success.body", event.username()));
        view.showLogin();
    }

    @Override
    public void onRegistrationFailure(RegistrationFailed event) {
        view.setStatus(event.reason());
        dialogService.error(Internationalization.text("home.register.error.title"),
                Internationalization.text("home.register.error.body", event.reason()));
        SwingUtilities.invokeLater(() -> view.registerForm().focusDefaultField());
    }

    private void showLanding() {
        view.showLanding();
        view.setStatus("");
    }

    private void closeShortcuts() {
        if (shortcutScope == null) {
            return;
        }
        try {
            shortcutScope.close();
        } catch (Exception ignored) {
        }
        shortcutScope = null;
    }
}
