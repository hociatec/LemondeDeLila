package com.lemondelila.client.user.model;

import java.util.Arrays;
import java.util.Objects;

/**
 * Represente les identifiants d'un utilisateur.
 */
public record UserCredentials(String username, char[] password) {

    public UserCredentials {
        Objects.requireNonNull(password, "password");
        username = username == null ? "" : username.trim();
    }

    public boolean isComplete() {
        return !username.isBlank() && password.length > 0;
    }

    public String passwordAsString() {
        return new String(password);
    }

    public void clearSensitiveData() {
        Arrays.fill(password, '\0');
    }
}
