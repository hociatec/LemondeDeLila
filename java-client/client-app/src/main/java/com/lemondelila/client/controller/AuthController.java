package com.lemondelila.client.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.events.LoginFailed;
import com.lemondelila.client.events.LoginRequested;
import com.lemondelila.client.events.LoginSucceeded;
import com.lemondelila.client.events.RegistrationFailed;
import com.lemondelila.client.events.RegistrationRequested;
import com.lemondelila.client.events.RegistrationSucceeded;
import com.lemondelila.client.session.ClientSession;
import com.lemondelila.framework.core.event.DomainEventBus;
import com.lemondelila.framework.core.task.TaskScheduler;
import com.lemondelila.framework.network.rest.RestClient;

import java.io.IOException;
import java.util.Arrays;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

public final class AuthController implements AutoCloseable {

    private final DomainEventBus eventBus;
    private final RestClient restClient;
    private final TaskScheduler scheduler;
    private final ClientSession session;
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private final AutoCloseable loginSubscription;
    private final AutoCloseable registrationSubscription;

    public AuthController(DomainEventBus eventBus,
                          RestClient restClient,
                          TaskScheduler scheduler,
                          ClientSession session) {
        this.eventBus = eventBus;
        this.restClient = restClient;
        this.scheduler = scheduler;
        this.session = session;
        this.loginSubscription = eventBus.subscribe(LoginRequested.class, this::handleLogin);
        this.registrationSubscription = eventBus.subscribe(RegistrationRequested.class, this::handleRegistration);
    }

    private void handleLogin(LoginRequested request) {
        if (!busy.compareAndSet(false, true)) {
            eventBus.publish(new LoginFailed("Une operation est deja en cours"));
            wipe(request.password());
            return;
        }
        scheduler.runAsync(() -> {
            try {
                JsonNode response = restClient.post("login", Map.of(
                        "username", request.username(),
                        "password", String.valueOf(request.password())
                ));
                String token = response.path("token").asText();
                if (token == null || token.isBlank()) {
                    throw new IOException("Token JWT absent dans la réponse");
                }
                session.setAuthenticated(request.username(), token);
                eventBus.publish(new LoginSucceeded(request.username(), token));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                eventBus.publish(new LoginFailed("Connexion interrompue"));
                session.clear();
            } catch (IOException e) {
                eventBus.publish(new LoginFailed("Connexion impossible : " + cleanMessage(e.getMessage())));
                session.clear();
            } catch (Exception e) {
                eventBus.publish(new LoginFailed("Echec de connexion : " + cleanMessage(e.getMessage())));
                session.clear();
            } finally {
                wipe(request.password());
                busy.set(false);
            }
        });
    }

    private void handleRegistration(RegistrationRequested request) {
        if (!busy.compareAndSet(false, true)) {
            eventBus.publish(new RegistrationFailed("Une operation est deja en cours"));
            wipe(request.password());
            return;
        }
        scheduler.runAsync(() -> {
            try {
                JsonNode response = restClient.post("register", Map.of(
                        "username", request.username(),
                        "password", String.valueOf(request.password()),
                        "email", request.email()
                ));
                String username = response.path("username").asText(request.username());
                eventBus.publish(new RegistrationSucceeded(username));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                eventBus.publish(new RegistrationFailed("Inscription interrompue"));
            } catch (IOException e) {
                eventBus.publish(new RegistrationFailed("Inscription impossible : " + cleanMessage(e.getMessage())));
            } catch (Exception e) {
                eventBus.publish(new RegistrationFailed("Echec d'inscription : " + cleanMessage(e.getMessage())));
            } finally {
                wipe(request.password());
                busy.set(false);
            }
        });
    }

    private static void wipe(char[] pwd) {
        if (pwd != null) {
            Arrays.fill(pwd, '\0');
        }
    }

    private static String cleanMessage(String message) {
        if (message == null || message.isBlank()) {
            return "erreur inconnue";
        }
        return message.strip();
    }

    @Override
    public void close() throws Exception {
        if (loginSubscription != null) {
            loginSubscription.close();
        }
        if (registrationSubscription != null) {
            registrationSubscription.close();
        }
        session.clear();
    }
}
