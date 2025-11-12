package com.lemondelila.client.controller.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.events.user.LoginFailed;
import com.lemondelila.client.events.user.LoginRequested;
import com.lemondelila.client.events.user.LoginSucceeded;
import com.lemondelila.client.model.user.ClientSession;
import com.lemondelila.framework.core.di.Inject;
import com.lemondelila.framework.core.event.DomainEventBus;
import com.lemondelila.framework.core.task.TaskScheduler;
import com.lemondelila.framework.network.rest.RestClient;

import java.io.IOException;
import java.util.Map;

public final class LoginController implements AutoCloseable {

    private final DomainEventBus eventBus;
    private final RestClient restClient;
    private final TaskScheduler scheduler;
    private final ClientSession session;
    private final UserOperationGuard guard;
    private final AutoCloseable subscription;

    @Inject
    public LoginController(DomainEventBus eventBus,
                           RestClient restClient,
                           TaskScheduler scheduler,
                           ClientSession session,
                           UserOperationGuard guard) {
        this.eventBus = eventBus;
        this.restClient = restClient;
        this.scheduler = scheduler;
        this.session = session;
        this.guard = guard;
        this.subscription = eventBus.subscribe(LoginRequested.class, this::handleLogin);
    }

    private void handleLogin(LoginRequested request) {
        if (!guard.tryAcquire()) {
            eventBus.publish(new LoginFailed("Une operation est deja en cours"));
            UserControllerSupport.wipe(request.password());
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
                    throw new IOException("Token JWT absent dans la reponse");
                }
                session.setAuthenticated(request.username(), token);
                eventBus.publish(new LoginSucceeded(request.username(), token));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                eventBus.publish(new LoginFailed("Connexion interrompue"));
                session.clear();
            } catch (IOException e) {
                eventBus.publish(new LoginFailed("Connexion impossible : " + UserControllerSupport.cleanMessage(e.getMessage())));
                session.clear();
            } catch (Exception e) {
                eventBus.publish(new LoginFailed("Echec de connexion : " + UserControllerSupport.cleanMessage(e.getMessage())));
                session.clear();
            } finally {
                UserControllerSupport.wipe(request.password());
                guard.release();
            }
        });
    }

    @Override
    public void close() throws Exception {
        if (subscription != null) {
            subscription.close();
        }
        session.clear();
    }
}
