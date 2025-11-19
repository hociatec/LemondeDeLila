package com.lemondelila.client.game.service;

import com.lemondelila.client.user.model.ClientSession;

import java.util.Optional;

public final class GameSessionSupport {

    private final ClientSession session;

    public GameSessionSupport(ClientSession session) {
        this.session = session;
    }

    public Optional<String> currentUsername() {
        return session.authenticated().map(ClientSession.AuthState::username);
    }
}
