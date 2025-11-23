package com.lemondelila.client.game.room.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.PlayerState;
import com.lemondelila.client.game.room.model.TableState;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Mappe les extras de GenericGameState vers TableState (joueurs/bots).
 */
public final class RoomExtrasMapper {

    public void updateTableState(TableState tableState, java.util.Map<String, Object> extras) {
        if (tableState == null || extras == null || extras.isEmpty()) {
            return;
        }
        mapPlayers(tableState, extras.get("players"));
        mapBots(tableState, extras.get("bots"));
    }

    private void mapPlayers(TableState tableState, Object playersNode) {
        if (!(playersNode instanceof JsonNode node) || !node.isArray() || node.size() == 0) {
            return;
        }
        List<PlayerState> players = new ArrayList<>();
        node.forEach(p -> players.add(new PlayerState(
                p.path("id").isInt() ? p.get("id").asInt() : null,
                p.path("username").asText("Joueur")
        )));
        tableState.updatePlayers(players);
    }

    private void mapBots(TableState tableState, Object botsNode) {
        if (!(botsNode instanceof JsonNode node) || !node.isArray() || node.size() == 0) {
            return;
        }
        List<BotState> bots = new ArrayList<>();
        node.forEach(b -> bots.add(new BotState(
                b.path("id").isInt() ? b.get("id").asInt() : null,
                b.path("name").asText("Bot")
        )));
        tableState.updateBots(bots);
    }
}
