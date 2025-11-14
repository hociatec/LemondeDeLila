package com.lemondelila.client.presence.event;

public sealed interface PresenceEvent permits PresenceUpdateEvent, PresenceStateChangedEvent, PresenceErrorEvent {
}
