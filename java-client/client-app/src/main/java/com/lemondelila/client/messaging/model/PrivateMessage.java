package com.lemondelila.client.messaging.model;

import java.time.Instant;

public record PrivateMessage(
        String id,
        int senderId,
        String senderUsername,
        int recipientId,
        String recipientUsername,
        String text,
        Instant createdAt) {

    public boolean isFrom(String username) {
        return username != null && !username.isBlank() && senderUsername.equalsIgnoreCase(username);
    }
}
