package com.lemondelila.client.controller.user;

import java.util.Arrays;

final class UserControllerSupport {

    private UserControllerSupport() {
    }

    static void wipe(char[] password) {
        if (password != null) {
            Arrays.fill(password, '\0');
        }
    }

    static String cleanMessage(String message) {
        if (message == null || message.isBlank()) {
            return "erreur inconnue";
        }
        return message.strip();
    }
}
