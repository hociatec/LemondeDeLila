package com.lemondelila.client.application.view.home;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.user.events.LoginFailed;
import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.events.RegistrationFailed;
import com.lemondelila.client.user.events.RegistrationSucceeded;

import java.util.ArrayList;
import java.util.List;

final class HomeEventCoordinator {

    interface Listener {
        void onLoginSuccess(LoginSucceeded event);

        void onLoginFailure(LoginFailed event);

        void onRegistrationSuccess(RegistrationSucceeded event);

        void onRegistrationFailure(RegistrationFailed event);
    }

    private final DomainEventBus eventBus;
    private final List<AutoCloseable> subscriptions = new ArrayList<>();

    HomeEventCoordinator(DomainEventBus eventBus) {
        this.eventBus = eventBus;
    }

    void subscribe(Listener listener) {
        unsubscribe();
        subscriptions.add(eventBus.subscribe(LoginSucceeded.class, listener::onLoginSuccess));
        subscriptions.add(eventBus.subscribe(LoginFailed.class, listener::onLoginFailure));
        subscriptions.add(eventBus.subscribe(RegistrationSucceeded.class, listener::onRegistrationSuccess));
        subscriptions.add(eventBus.subscribe(RegistrationFailed.class, listener::onRegistrationFailure));
    }

    void unsubscribe() {
        subscriptions.forEach(closeable -> {
            try {
                closeable.close();
            } catch (Exception ignored) {
            }
        });
        subscriptions.clear();
    }
}
