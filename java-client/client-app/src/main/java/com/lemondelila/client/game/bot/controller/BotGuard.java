package com.lemondelila.client.game.bot.controller;

import com.lemondelila.client.game.session.controller.SessionGuard;

public final class BotGuard {

    private final SessionGuard sessionGuard;

    public BotGuard(SessionGuard sessionGuard) {
        this.sessionGuard = sessionGuard;
    }

    public boolean ensureAuthenticated() {
        return sessionGuard.ensureAuthenticated();
    }
}
