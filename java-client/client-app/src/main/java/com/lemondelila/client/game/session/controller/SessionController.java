package com.lemondelila.client.game.session.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.game.session.event.LoginFailed;
import com.lemondelila.client.game.session.event.LoginRequested;
import com.lemondelila.client.game.session.event.LoginSucceeded;
import com.lemondelila.client.game.session.event.LogoutRequested;
import com.lemondelila.client.game.session.event.SessionChanged;
import com.lemondelila.client.game.session.model.SessionState;
import com.lemondelila.client.game.session.service.SessionApiService;

import java.io.IOException;
import java.util.Optional;

public final class SessionController implements AutoCloseable {

    private final DomainEventBus eventBus;
    private final SessionApiService api;
    private final SessionState state;
    private final TaskScheduler scheduler;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public SessionController(DomainEventBus eventBus,
                             SessionApiService api,
                             SessionState state,
                             TaskScheduler scheduler) {
        this.eventBus = eventBus;
        this.api = api;
        this.state = state;
        this.scheduler = scheduler;
        subscriptions.subscribe(eventBus, LoginRequested.class, this::handleLogin);
        subscriptions.subscribe(eventBus, LogoutRequested.class, event -> logout());
    }

    private void handleLogin(LoginRequested request) {
        final char[] password = request.password();
        scheduler.runAsync(() -> {
            try {
                var response = api.login(request.username(), password);
                String token = response.token();
                if (token == null || token.isBlank()) {
                    throw new IOException("Token JWT manquant");
                }
                state.update(request.username(), token);
                eventBus.publish(new LoginSucceeded(request.username(), token));
                eventBus.publish(new SessionChanged(Optional.of(request.username()), "authenticated"));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                eventBus.publish(new LoginFailed("Connexion interrompue"));
                state.clear();
                eventBus.publish(new SessionChanged(Optional.empty(), "cleared"));
            } catch (Exception e) {
                eventBus.publish(new LoginFailed("Echec de connexion : " + cleanMessage(e.getMessage())));
                state.clear();
                eventBus.publish(new SessionChanged(Optional.empty(), "cleared"));
            } finally {
                wipe(password);
            }
        });
    }

    public void logout() {
        state.clear();
        eventBus.publish(new SessionChanged(Optional.empty(), "logout"));
    }

    @Override
    public void close() {
        subscriptions.close();
    }

    private static String cleanMessage(String message) {
        if (message == null) return "erreur";
        return message.replaceAll("\\s+", " ").trim();
    }

    private static void wipe(char[] data) {
        if (data == null) return;
        for (int i = 0; i < data.length; i++) {
            data[i] = 0;
        }
    }
}
