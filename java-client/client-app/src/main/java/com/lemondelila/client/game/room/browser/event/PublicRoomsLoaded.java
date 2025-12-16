package com.lemondelila.client.game.room.browser.event;

import com.lemondelila.client.game.room.browser.model.PublicRoomSummary;
import java.util.List;

public record PublicRoomsLoaded(List<PublicRoomSummary> rooms) {
}

