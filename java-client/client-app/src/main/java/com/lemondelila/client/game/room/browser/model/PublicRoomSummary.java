package com.lemondelila.client.game.room.browser.model;

public record PublicRoomSummary(int id,
                                String name,
                                String gameType,
                                String status,
                                int maxPlayers,
                                int playersCount,
                                int botsCount,
                                String ownerUsername) {
    @Override
    public String toString() {
        String owner = ownerUsername == null || ownerUsername.isBlank() ? "?" : ownerUsername;
        int current = playersCount + botsCount;
        return "#" + id + " " + name + " (" + gameType + ") " + current + "/" + maxPlayers + " - " + status + " - " + owner;
    }
}

