package com.lemondelila.client.user.controller;

import com.lemondelila.client.user.dto.RegistrationResponseDto;
import com.lemondelila.client.user.events.RegistrationFailed;
import com.lemondelila.client.user.events.RegistrationRequested;
import com.lemondelila.client.user.events.RegistrationSucceeded;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;

import java.io.IOException;
import java.util.Map;

public final class RegistrationController implements AutoCloseable {

    private final DomainEventBus eventBus;
    private final RestClient restClient;
    private final TaskScheduler scheduler;
    private final UserOperationGuard guard;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public RegistrationController(DomainEventBus eventBus,
                                  RestClient restClient,
                                  TaskScheduler scheduler,
                                  UserOperationGuard guard) {
        this.eventBus = eventBus;
        this.restClient = restClient;
        this.scheduler = scheduler;
        this.guard = guard;
        subscriptions.subscribe(eventBus, RegistrationRequested.class, this::handleRegistration);
    }

    private void handleRegistration(RegistrationRequested request) {
        if (!guard.tryAcquire()) {
            eventBus.publish(new RegistrationFailed("Une operation est deja en cours"));
            UserControllerSupport.wipe(request.password());
            return;
        }
        scheduler.runAsync(() -> {
            try {
                RegistrationResponseDto response = restClient.post("register", Map.of(
                        "username", request.username(),
                        "password", String.valueOf(request.password()),
                        "email", request.email()
                ), RegistrationResponseDto.class);
                String username = response.username() == null || response.username().isBlank()
                        ? request.username()
                        : response.username();
                eventBus.publish(new RegistrationSucceeded(username));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                eventBus.publish(new RegistrationFailed("Inscription interrompue"));
            } catch (IOException e) {
                eventBus.publish(new RegistrationFailed("Inscription impossible : " + UserControllerSupport.cleanMessage(e.getMessage())));
            } catch (Exception e) {
                eventBus.publish(new RegistrationFailed("Echec d'inscription : " + UserControllerSupport.cleanMessage(e.getMessage())));
            } finally {
                UserControllerSupport.wipe(request.password());
                guard.release();
            }
        });
    }

    @Override
    public void close() throws Exception {
        subscriptions.close();
    }
}
