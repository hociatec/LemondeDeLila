package com.lemondelila.client.session.service;

import com.lemondelila.client.session.controller.SessionController;
import com.lemondelila.client.session.listener.SessionListener;
import com.lemondelila.client.session.model.SessionModel;

import java.util.Objects;
import java.util.Optional;

/**
 * Facade applicative pour manipuler la session.
 */
public final class SessionService {

    private final SessionController controller;

    public SessionService(SessionController controller) {
        this.controller = Objects.requireNonNull(controller, "controller");
    }

    public void addListener(SessionListener listener) {
        controller.addListener(listener);
    }

    public void removeListener(SessionListener listener) {
        controller.removeListener(listener);
    }

    public void openSession(String username, String token) {
        controller.openSession(username, token);
    }

    public void closeSession() {
        controller.closeSession();
    }

    public boolean isActive() {
        return controller.model().isActive();
    }

    public Optional<String> username() {
        return controller.model().username();
    }

    public Optional<String> token() {
        return controller.model().token();
    }

    public Optional<SessionModel> model() {
        return Optional.of(controller.model());
    }
}



