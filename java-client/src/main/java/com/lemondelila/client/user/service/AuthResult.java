package com.lemondelila.client.user.service;

import java.util.Optional;

/**
 * Resultat d'une tentative d'authentification.
 */
public final class AuthResult {

    private final boolean success;
    private final String token;
    private final String message;

    private AuthResult(boolean success, String token, String message) {
        this.success = success;
        this.token = token;
        this.message = message;
    }

    public static AuthResult success(String token) {
        return new AuthResult(true, token, "Connexion reussie.");
    }

    public static AuthResult failure(String message) {
        return new AuthResult(false, null, message);
    }

    public boolean isSuccess() {
        return success;
    }

    public Optional<String> token() {
        return Optional.ofNullable(token);
    }

    public String message() {
        return message;
    }
}
