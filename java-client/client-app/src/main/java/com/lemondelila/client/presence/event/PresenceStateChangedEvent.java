package com.lemondelila.client.presence.event;

import com.lemondelila.client.chat.model.ChatState;

public record PresenceStateChangedEvent(ChatState state) implements PresenceEvent {
}
