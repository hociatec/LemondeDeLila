package com.lemondelila.client.game.room.controller;

import com.lemondelila.client.game.session.controller.SessionGuard;

public final class RoomAccessGuard {

    private final SessionGuard sessionGuard;

    public RoomAccessGuard(SessionGuard sessionGuard) {
        this.sessionGuard = sessionGuard;
    }

    public boolean ensureAuthenticated() {
        return sessionGuard.ensureAuthenticated();
    }
}
