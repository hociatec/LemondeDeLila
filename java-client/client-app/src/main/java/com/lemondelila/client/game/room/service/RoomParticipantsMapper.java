package com.lemondelila.client.game.room.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.PlayerState;
import com.lemondelila.client.game.room.model.TableState;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Fournit des helpers de mapping joueurs/bots partag├®s entre RoomMapper et les extras temps r├®el.
 */
public final class RoomParticipantsMapper {

    private RoomParticipantsMapper() { }

    public static List<PlayerState> mapPlayers(JsonNode node) {
        List<PlayerState> players = new ArrayList<>();
        if (node != null && node.isArray()) {
            node.forEach(p -> players.add(new PlayerState(
                    p.path("id").isInt() ? p.get("id").asInt() : null,
                    p.path("username").asText("Joueur")
            )));
        }
        return players;
    }

    public static List<BotState> mapBots(JsonNode node) {
        List<BotState> bots = new ArrayList<>();
        if (node != null && node.isArray()) {
            node.forEach(b -> bots.add(new BotState(
                    b.path("id").isInt() ? b.get("id").asInt() : null,
                    b.path("name").asText("Bot")
            )));
        }
        return bots;
    }

    public static void updateFromExtras(TableState tableState, Map<String, Object> extras) {
        if (tableState == null || extras == null || extras.isEmpty()) return;
        Object playersNode = extras.get("players");
        if (playersNode instanceof JsonNode node && node.isArray()) {
            tableState.updatePlayers(mapPlayers(node));
        }
        Object botsNode = extras.get("bots");
        if (botsNode instanceof JsonNode node && node.isArray()) {
            tableState.updateBots(mapBots(node));
        }
    }
}
