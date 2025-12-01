package com.lemondelila.client.home.controller;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.user.events.LoginFailed;
import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.events.RegistrationFailed;
import com.lemondelila.client.user.events.RegistrationSucceeded;

public final class HomeEventCoordinator {

    public interface Listener {
        void onLoginSuccess(LoginSucceeded event);

        void onLoginFailure(LoginFailed event);

        void onRegistrationSuccess(RegistrationSucceeded event);

        void onRegistrationFailure(RegistrationFailed event);
    }

    private final DomainEventBus eventBus;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    public HomeEventCoordinator(DomainEventBus eventBus) {
        this.eventBus = eventBus;
    }

    void subscribe(Listener listener) {
        unsubscribe();
        subscriptions.subscribe(eventBus, LoginSucceeded.class, listener::onLoginSuccess);
        subscriptions.subscribe(eventBus, LoginFailed.class, listener::onLoginFailure);
        subscriptions.subscribe(eventBus, RegistrationSucceeded.class, listener::onRegistrationSuccess);
        subscriptions.subscribe(eventBus, RegistrationFailed.class, listener::onRegistrationFailure);
    }

    void unsubscribe() {
        subscriptions.clear();
    }
}
