package com.lemondelila.client.game.room.model;

public record RoomInvite(String invitationId,
                         int roomId,
                         String roomName,
                         String gameType,
                         int maxPlayers,
                         String status,
                         long expiresAt,
                         int fromUserId,
                         String fromUsername) {
}

