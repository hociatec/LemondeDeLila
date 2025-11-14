package com.lemondelila.client.presence.event;

@FunctionalInterface
public interface PresenceEventListener {
    void onEvent(PresenceEvent event);
}
