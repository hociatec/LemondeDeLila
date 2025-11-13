package com.lemondelila.client.game.model;

final class GameErrors {

    private GameErrors() {
    }

    static String describe(Throwable error) {
        if (error == null) {
            return "Erreur inconnue";
        }
        Throwable root = unwrap(error);
        String message = root.getMessage();
        if (message == null || message.isBlank()) {
            message = root.toString();
        }
        return message;
    }

    static Throwable unwrap(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current;
    }
}
