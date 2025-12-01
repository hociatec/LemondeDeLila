package com.lemondelila.client.game.room.event;

public record RoomPrivacyChanged(int roomId, boolean isPrivate) {
}
