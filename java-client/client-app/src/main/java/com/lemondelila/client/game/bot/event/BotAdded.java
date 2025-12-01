package com.lemondelila.client.game.bot.event;

import com.lemondelila.client.game.room.model.BotState;

public record BotAdded(int roomId, BotState bot) {
}
