package com.lemondelila.client.user.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.user.dto.LoginResponseDto;
import com.lemondelila.client.user.events.LoginFailed;
import com.lemondelila.client.user.events.LoginRequested;
import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.user.service.RememberedCredentialsService;

import java.io.IOException;
import java.util.Map;

public final class LoginController implements AutoCloseable {

    private final DomainEventBus eventBus;
    private final RestClient restClient;
    private final TaskScheduler scheduler;
    private final ClientSession session;
    private final UserOperationGuard guard;
    private final RememberedCredentialsService rememberedCredentialsService;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public LoginController(DomainEventBus eventBus,
                           RestClient restClient,
                           TaskScheduler scheduler,
                           ClientSession session,
                           UserOperationGuard guard,
                           RememberedCredentialsService rememberedCredentialsService) {
        this.eventBus = eventBus;
        this.restClient = restClient;
        this.scheduler = scheduler;
        this.session = session;
        this.guard = guard;
        this.rememberedCredentialsService = rememberedCredentialsService;
        subscriptions.subscribe(eventBus, LoginRequested.class, this::handleLogin);
    }

    private void handleLogin(LoginRequested request) {
        if (!guard.tryAcquire()) {
            eventBus.publish(new LoginFailed("Une operation est deja en cours"));
            UserControllerSupport.wipe(request.password());
            return;
        }
        scheduler.runAsync(() -> {
            try {
                LoginResponseDto response = restClient.post("login", Map.of(
                        "username", request.username(),
                        "password", String.valueOf(request.password())
                ), LoginResponseDto.class);
                String token = response.token();
                if (token == null || token.isBlank()) {
                    throw new IOException("Token JWT absent dans la reponse");
                }
                session.setAuthenticated(request.username(), token);
                if (request.rememberMe()) {
                    rememberedCredentialsService.save(request.username(), request.password());
                } else {
                    rememberedCredentialsService.clear();
                }
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
        subscriptions.close();
        session.clear();
    }
}
