package com.lemondelila.client.game.session.controller;

import com.lemondelila.client.game.session.model.SessionState;

public final class SessionGuard {

    private final SessionState sessionState;

    public SessionGuard(SessionState sessionState) {
        this.sessionState = sessionState;
    }

    public boolean ensureAuthenticated() {
        return sessionState.isAuthenticated();
    }
}
