package com.lemondelila.client.session.model;

import java.time.Instant;
import java.util.Optional;

/**
 * Modele memoire representant l'etat de session de l'utilisateur connecte.
 */
public final class SessionModel {

    private boolean active;
    private String username;
    private String token;
    private Instant openedAt;

    public synchronized void open(String username, String token) {
        this.active = true;
        this.username = username;
        this.token = token;
        this.openedAt = Instant.now();
    }

    public synchronized void close() {
        this.active = false;
        this.username = null;
        this.token = null;
        this.openedAt = null;
    }

    public synchronized boolean isActive() {
        return active;
    }

    public synchronized Optional<String> username() {
        return Optional.ofNullable(username);
    }

    public synchronized Optional<String> token() {
        return Optional.ofNullable(token);
    }

    public synchronized Optional<Instant> openedAt() {
        return Optional.ofNullable(openedAt);
    }
}
