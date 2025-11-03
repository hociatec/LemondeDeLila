package com.lemondelila.client.user.model;

import java.time.Instant;
import java.util.Optional;

/**
 * Modele applicatif pour l'etat de connexion.
 */
public final class LoginModel {

    private boolean authenticated;
    private String username;
    private String token;
    private Instant authenticatedAt;

    public synchronized void markAuthenticated(String username, String token) {
        this.authenticated = true;
        this.username = username;
        this.token = token;
        this.authenticatedAt = Instant.now();
    }

    public synchronized void reset() {
        this.authenticated = false;
        this.username = null;
        this.token = null;
        this.authenticatedAt = null;
    }

    public synchronized boolean isAuthenticated() {
        return authenticated;
    }

    public synchronized Optional<String> username() {
        return Optional.ofNullable(username);
    }

    public synchronized Optional<String> token() {
        return Optional.ofNullable(token);
    }

    public synchronized Optional<Instant> authenticatedAt() {
        return Optional.ofNullable(authenticatedAt);
    }
}
