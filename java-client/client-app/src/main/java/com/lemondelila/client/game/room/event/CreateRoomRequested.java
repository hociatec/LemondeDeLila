package com.lemondelila.client.game.room.event;

public record CreateRoomRequested(String name, String gameType, int maxPlayers, boolean isPrivate) {
}
