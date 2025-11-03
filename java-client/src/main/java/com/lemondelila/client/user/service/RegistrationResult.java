package com.lemondelila.client.user.service;

/**
 * Resultat d'une tentative d'inscription.
 */
public final class RegistrationResult {

    private final boolean success;
    private final String message;

    private RegistrationResult(boolean success, String message) {
        this.success = success;
        this.message = message;
    }

    public static RegistrationResult success(String message) {
        return new RegistrationResult(true, message);
    }

    public static RegistrationResult failure(String message) {
        return new RegistrationResult(false, message);
    }

    public boolean isSuccess() {
        return success;
    }

    public String message() {
        return message;
    }
}
