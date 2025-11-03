package com.lemondelila.client.user.controller;

import com.lemondelila.client.history.service.HistoryService;
import com.lemondelila.client.session.listener.SessionListener;
import com.lemondelila.client.session.service.SessionService;
import com.lemondelila.client.user.model.LoginModel;
import com.lemondelila.client.user.model.UserCredentials;
import com.lemondelila.client.user.service.AuthClient;
import com.lemondelila.client.user.service.AuthResult;
import com.lemondelila.client.user.view.LoginView;

import javax.swing.SwingWorker;
import java.util.Objects;
import java.util.concurrent.ExecutionException;

/**
 * Controleur du formulaire de connexion.
 */
public final class LoginController {

    private final LoginModel model;
    private final AuthClient authClient;
    private final LoginView view;
    private final HistoryService historyService;
    private final SessionService sessionService;

    public LoginController(LoginModel model,
                           AuthClient authClient,
                           LoginView view,
                           HistoryService historyService,
                           SessionService sessionService) {
        this.model = Objects.requireNonNull(model, "model");
        this.authClient = Objects.requireNonNull(authClient, "authClient");
        this.view = Objects.requireNonNull(view, "view");
        this.historyService = Objects.requireNonNull(historyService, "historyService");
        this.sessionService = Objects.requireNonNull(sessionService, "sessionService");
        this.sessionService.addListener(new SessionListener() {
            @Override
            public void onSessionOpened(String username, String token) {
                model.markAuthenticated(username, token);
            }

            @Override
            public void onSessionClosed() {
                model.reset();
            }
        });
    }

    public void init() {
        view.setLoginListener(this::handleLoginRequest);
        view.clearPassword();
    }

    private void handleLoginRequest(String username, char[] password) {
        UserCredentials credentials = new UserCredentials(username, password);
        if (!credentials.isComplete()) {
            String message = "Identifiant et mot de passe sont requis.";
            view.showError(message);
            historyService.append("Connexion", message);
            view.clearPassword();
            view.focusUsername();
            credentials.clearSensitiveData();
            return;
        }

        historyService.append("Connexion", "Tentative pour l'utilisateur \"" + credentials.username() + "\".");
        view.setLoading(true);

        SwingWorker<AuthResult, Void> worker = new SwingWorker<>() {
            @Override
            protected AuthResult doInBackground() {
                return authClient.authenticate(credentials);
            }

            @Override
            protected void done() {
                try {
                    AuthResult result = get();
                    if (result.isSuccess()) {
                        String token = result.token().orElse("");
                        model.markAuthenticated(credentials.username(), token);
                        sessionService.openSession(credentials.username(), token);
                        view.showSuccess(result.message());
                        historyService.append("Connexion", result.message());
                    } else {
                        model.reset();
                        view.showError(result.message());
                        historyService.append("Connexion", result.message());
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    model.reset();
                    String message = "Operation interrompue.";
                    view.showError(message);
                    historyService.append("Connexion", message);
                } catch (ExecutionException e) {
                    model.reset();
                    String message = "Erreur lors de la connexion : "
                            + (e.getCause() != null ? e.getCause().getMessage() : e.getMessage());
                    view.showError(message);
                    historyService.append("Connexion", message);
                } finally {
                    view.setLoading(false);
                    view.clearPassword();
                    credentials.clearSensitiveData();
                }
            }
        };
        worker.execute();
    }
}
