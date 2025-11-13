package com.lemondelila.client.model.chat;

import java.time.Instant;

public record ChatMessage(long id, String username, String text, Instant createdAt) {
}

