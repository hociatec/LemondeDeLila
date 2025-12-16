package com.lemondelila.client.presence.model;

public record PresencePlayer(int id,
                             String username,
                             PresenceChat currentRoom,
                             PresenceActivity activity) {

    public PresencePlayer {
        activity = activity == null ? PresenceActivity.UNKNOWN : activity;
    }
}

