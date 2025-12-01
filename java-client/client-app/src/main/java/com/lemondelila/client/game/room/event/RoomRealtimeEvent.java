package com.lemondelila.client.game.room.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.room.model.RoomState;

public record RoomRealtimeEvent(RoomState room, JsonNode payload) {
}
