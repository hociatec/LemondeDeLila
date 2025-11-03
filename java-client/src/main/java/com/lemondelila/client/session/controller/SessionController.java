package com.lemondelila.client.session.controller;

import com.lemondelila.client.session.listener.SessionListener;
import com.lemondelila.client.session.model.SessionModel;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Controleur charge de mettre a jour le modele de session
 * et d'avertir les listeners.
 */
public final class SessionController {

    private final SessionModel model;
    private final List<SessionListener> listeners = new CopyOnWriteArrayList<>();

    public SessionController(SessionModel model) {
        this.model = Objects.requireNonNull(model, "model");
    }

    public SessionModel model() {
        return model;
    }

    public void addListener(SessionListener listener) {
        Objects.requireNonNull(listener, "listener");
        listeners.add(listener);
    }

    public void removeListener(SessionListener listener) {
        listeners.remove(listener);
    }

    public void openSession(String username, String token) {
        model.open(username, token);
        for (SessionListener listener : listeners) {
            listener.onSessionOpened(username, token);
        }
    }

    public void closeSession() {
        if (!model.isActive()) {
            return;
        }
        model.close();
        for (SessionListener listener : listeners) {
            listener.onSessionClosed();
        }
    }
}
