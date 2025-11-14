package com.lemondelila.client.presence.event;

import com.lemondelila.client.presence.model.PresencePlayer;

import java.util.List;

public record PresenceUpdateEvent(List<PresencePlayer> players) implements PresenceEvent {
    public PresenceUpdateEvent {
        players = List.copyOf(players);
    }
}
