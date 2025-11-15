package com.lemondelila.client.framework.ui.screen;

import java.util.Locale;
import java.util.Objects;

/**
 * Identifiant typé pour un écran de l'application.
 */
public record ScreenId(String value) {

    public ScreenId {
        Objects.requireNonNull(value, "value");
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("screen id must not be blank");
        }
        value = normalized.toLowerCase(Locale.ROOT);
    }

    public static ScreenId of(String value) {
        return new ScreenId(value);
    }

    @Override
    public String toString() {
        return value;
    }
}
