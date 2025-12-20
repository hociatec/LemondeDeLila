package com.lemondelila.client.game.room.event;

public record RoomRoleChanged(int roomId, boolean spectator, String message) {
}
