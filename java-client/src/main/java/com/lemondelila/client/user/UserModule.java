package com.lemondelila.client.user;

import com.lemondelila.client.config.ClientConfig;
import com.lemondelila.client.history.HistoryModule;
import com.lemondelila.client.history.service.HistoryService;
import com.lemondelila.client.history.view.SwingHistoryView;
import com.lemondelila.client.menu.MenuModule;
import com.lemondelila.client.session.SessionModule;
import com.lemondelila.client.session.service.SessionService;
import com.lemondelila.client.ui.SwingAuthView;
import com.lemondelila.client.user.controller.LoginController;
import com.lemondelila.client.user.controller.RegistrationController;
import com.lemondelila.client.user.model.LoginModel;
import com.lemondelila.client.user.model.RegistrationModel;
import com.lemondelila.client.user.service.AuthClient;
import com.lemondelila.client.user.view.SwingLoginPanel;
import com.lemondelila.client.user.view.SwingRegistrationPanel;

/**
 * Point d'assemblage du module utilisateur.
 * Instancie les differentes couches en respectant MVC.
 */
public final class UserModule {

    private final ClientConfig config;
    private final HistoryModule historyModule;
    private final SessionModule sessionModule;
    private MenuModule menuModule;

    public UserModule(ClientConfig config, HistoryModule historyModule, SessionModule sessionModule) {
        this.config = config;
        this.historyModule = historyModule;
        this.sessionModule = sessionModule;
    }

    public void start() {
        HistoryService historyService = historyModule.service();
        SwingHistoryView historyView = historyModule.view();
        SessionService sessionService = sessionModule.service();

        LoginModel loginModel = new LoginModel();
        RegistrationModel registrationModel = new RegistrationModel();
        AuthClient authClient = new AuthClient(config.loginUri(), config.registerUri());
        SwingLoginPanel loginPanel = new SwingLoginPanel();
        SwingRegistrationPanel registrationPanel = new SwingRegistrationPanel();

        SwingAuthView authView = new SwingAuthView(loginPanel, registrationPanel, historyView);

        RegistrationController registrationController =
                new RegistrationController(registrationModel, authClient, registrationPanel, historyService);
        LoginController loginController =
                new LoginController(loginModel, authClient, loginPanel, historyService, sessionService);

        this.menuModule = new MenuModule(
                config,
                sessionService,
                historyService
        );
        this.menuModule.attachTo(authView);

        registrationController.init();
        loginController.init();

        historyService.append("Application", "Bienvenue dans l'application client.");
        authView.showHome();
    }
}
