package com.lemondelila.client.user.controller;

import com.lemondelila.client.history.service.HistoryService;
import com.lemondelila.client.user.model.RegistrationModel;
import com.lemondelila.client.user.model.UserRegistration;
import com.lemondelila.client.user.service.AuthClient;
import com.lemondelila.client.user.service.RegistrationResult;
import com.lemondelila.client.user.view.RegistrationView;

import javax.swing.SwingWorker;
import java.util.Objects;
import java.util.concurrent.ExecutionException;

/**
 * Controleur du formulaire d'inscription.
 */
public final class RegistrationController {

    private final RegistrationModel model;
    private final AuthClient authClient;
    private final RegistrationView view;
    private final HistoryService historyService;

    public RegistrationController(RegistrationModel model,
                                  AuthClient authClient,
                                  RegistrationView view,
                                  HistoryService historyService) {
        this.model = Objects.requireNonNull(model, "model");
        this.authClient = Objects.requireNonNull(authClient, "authClient");
        this.view = Objects.requireNonNull(view, "view");
        this.historyService = Objects.requireNonNull(historyService, "historyService");
    }

    public void init() {
        view.setRegistrationListener(this::handleRegistrationRequest);
        view.clearRegistrationForm();
    }

    private void handleRegistrationRequest(String username, String email, char[] password) {
        UserRegistration registration = new UserRegistration(username, email, password);
        if (!registration.hasUsername()) {
            String message = "Un identifiant est requis.";
            view.showRegistrationError(message);
            historyService.append("Inscription", message);
            view.clearRegistrationPassword();
            view.focusRegistrationUsername();
            registration.clearSensitiveData();
            return;
        }
        if (!registration.hasEmail()) {
            String message = "Une adresse email est requise.";
            view.showRegistrationError(message);
            historyService.append("Inscription", message);
            view.clearRegistrationPassword();
            registration.clearSensitiveData();
            return;
        }
        if (!registration.isEmailValid()) {
            String message = "Adresse email invalide.";
            view.showRegistrationError(message);
            historyService.append("Inscription", message);
            view.clearRegistrationPassword();
            registration.clearSensitiveData();
            return;
        }
        if (!registration.hasPassword()) {
            String message = "Un mot de passe est requis.";
            view.showRegistrationError(message);
            historyService.append("Inscription", message);
            registration.clearSensitiveData();
            return;
        }
        if (!registration.isPasswordStrongEnough()) {
            String message = "Le mot de passe doit contenir au moins 6 caracteres.";
            view.showRegistrationError(message);
            historyService.append("Inscription", message);
            view.clearRegistrationPassword();
            registration.clearSensitiveData();
            return;
        }

        historyService.append("Inscription", "Tentative pour l'utilisateur \"" + registration.username() + "\".");
        view.setRegistrationLoading(true);

        SwingWorker<RegistrationResult, Void> worker = new SwingWorker<>() {
            @Override
            protected RegistrationResult doInBackground() {
                return authClient.register(registration);
            }

            @Override
            protected void done() {
                try {
                    RegistrationResult result = get();
                    if (result.isSuccess()) {
                        model.markRegistered();
                        view.showRegistrationSuccess(result.message());
                        historyService.append("Inscription", result.message());
                        view.clearRegistrationForm();
                        view.switchToLoginTab();
                    } else {
                        model.reset();
                        view.showRegistrationError(result.message());
                        historyService.append("Inscription", result.message());
                        view.clearRegistrationPassword();
                    }
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    model.reset();
                    String message = "Operation interrompue.";
                    view.showRegistrationError(message);
                    historyService.append("Inscription", message);
                    view.clearRegistrationPassword();
                } catch (ExecutionException e) {
                    model.reset();
                    String message = "Erreur lors de l'inscription : "
                            + (e.getCause() != null ? e.getCause().getMessage() : e.getMessage());
                    view.showRegistrationError(message);
                    historyService.append("Inscription", message);
                    view.clearRegistrationPassword();
                } finally {
                    view.setRegistrationLoading(false);
                    registration.clearSensitiveData();
                }
            }
        };
        worker.execute();
    }
}
