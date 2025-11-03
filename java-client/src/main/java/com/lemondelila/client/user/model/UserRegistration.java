package com.lemondelila.client.user.model;

import java.util.Arrays;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * Informations requises pour inscrire un utilisateur.
 */
public record UserRegistration(String username, String email, char[] password) {

    private static final Pattern SIMPLE_EMAIL_PATTERN = Pattern.compile(".+@.+\\..+");

    public UserRegistration {
        Objects.requireNonNull(password, "password");
        username = username == null ? "" : username.trim();
        email = email == null ? "" : email.trim();
    }

    public boolean hasUsername() {
        return !username.isBlank();
    }

    public boolean hasEmail() {
        return !email.isBlank();
    }

    public boolean hasPassword() {
        return password.length > 0;
    }

    public boolean isPasswordStrongEnough() {
        return password.length >= 6;
    }

    public boolean isEmailValid() {
        return SIMPLE_EMAIL_PATTERN.matcher(email).matches();
    }

    public String passwordAsString() {
        return new String(password);
    }

    public void clearSensitiveData() {
        Arrays.fill(password, '\0');
    }
}
