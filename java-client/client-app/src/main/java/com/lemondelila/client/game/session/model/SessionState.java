package com.lemondelila.client.game.session.model;

import com.lemondelila.client.user.model.ClientSession;

import java.util.Optional;

public final class SessionState {

    private final ClientSession clientSession;

    public SessionState(ClientSession clientSession) {
        this.clientSession = clientSession;
    }

    public boolean isAuthenticated() {
        return clientSession.authenticated().isPresent();
    }

    public Optional<AuthSnapshot> snapshot() {
        return clientSession.authenticated()
                .map(auth -> new AuthSnapshot(auth.username(), auth.token()));
    }

    public void update(String username, String token) {
        clientSession.setAuthenticated(username, token);
    }

    public void clear() {
        clientSession.clear();
    }

    public record AuthSnapshot(String username, String token) {
    }
}
