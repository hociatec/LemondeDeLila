package com.lemondelila.client.presence.model;

/**
 * Represents the high-level activity of a connected player.
 */
public enum PresenceActivity {
    HOME,
    CHAT,
    TABLE,
    UNKNOWN;

    public static PresenceActivity fromWire(String raw) {
        if (raw == null || raw.isBlank()) {
            return UNKNOWN;
        }
        return switch (raw.trim().toLowerCase()) {
            case "home" -> HOME;
            case "chat" -> CHAT;
            case "table" -> TABLE;
            default -> UNKNOWN;
        };
    }
}
