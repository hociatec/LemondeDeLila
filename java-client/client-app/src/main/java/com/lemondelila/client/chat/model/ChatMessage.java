package com.lemondelila.client.chat.model;

import java.time.Instant;

public record ChatMessage(long id, String username, String text, Instant createdAt) {
}

