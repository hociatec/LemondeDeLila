package com.lemondelila.client.model.user;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

public final class ClientSession {

    private final AtomicReference<AuthState> state = new AtomicReference<>();

    public Optional<AuthState> authenticated() {
        return Optional.ofNullable(state.get());
    }

    public void setAuthenticated(String username, String token) {
        state.set(new AuthState(username, token));
    }

    public void clear() {
        state.set(null);
    }

    public record AuthState(String username, String token) {
    }
}

