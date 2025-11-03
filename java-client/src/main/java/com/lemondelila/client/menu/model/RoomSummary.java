package com.lemondelila.client.menu.model;

public record RoomSummary(
        int id,
        String name,
        String gameType,
        String status,
        int players,
        int maxPlayers,
        boolean isPrivate
) {
}
