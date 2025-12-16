package com.lemondelila.client.presence.model;

/**
 * Utility class to format a human readable status for a presence entry.
 */
public final class PresenceStatusFormatter {

    private PresenceStatusFormatter() {
    }

    public static String describe(PresencePlayer player) {
        if (player == null) {
            return "";
        }
        PresenceActivity activity = player.activity();
        return switch (activity) {
            case TABLE -> describeTable(player);
            case CHAT -> "Dans le tchat";
            case HOME -> "Sur l'accueil";
            case UNKNOWN -> defaultLabel(player);
        };
    }

    private static String describeTable(PresencePlayer player) {
        PresenceChat room = player.currentRoom();
        if (room == null) {
            return "Sur une table";
        }
        String name = room.name();
        if (name == null || name.isBlank()) {
            return "Sur la table #" + room.id();
        }
        return "Sur " + name.trim() + " (#" + room.id() + ")";
    }

    private static String defaultLabel(PresencePlayer player) {
        return player.currentRoom() != null
                ? describeTable(player)
                : "En ligne";
    }
}
