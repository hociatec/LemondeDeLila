package com.lemondelila.client.game.room.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.PlayerState;
import com.lemondelila.client.game.room.model.RoomState;

import java.util.ArrayList;
import java.util.List;

final class RoomMapper {

    private RoomMapper() {
    }

    static RoomState mapRoom(JsonNode json) {
        RoomState room = new RoomState()
                .withId(json.path("id").isInt() ? json.get("id").asInt() : null)
                .withName(json.path("name").asText(""))
                .withStatus(json.path("status").asText(""))
                .withGameType(json.path("gameType").asText(""))
                .withMaxPlayers(json.path("maxPlayers").asInt(0));

        JsonNode owner = json.path("owner");
        if (owner.isObject()) {
            room.withOwner(new RoomState.Owner(
                    owner.path("id").isInt() ? owner.get("id").asInt() : null,
                    owner.path("username").asText("")
            ));
        }

        List<PlayerState> players = new ArrayList<>();
        JsonNode playersNode = json.path("players");
        if (playersNode.isArray()) {
            playersNode.forEach(p -> players.add(new PlayerState(
                    p.path("id").isInt() ? p.get("id").asInt() : null,
                    p.path("username").asText("")
            )));
        }
        room.replacePlayers(players);

        List<BotState> bots = new ArrayList<>();
        JsonNode botsNode = json.path("bots");
        if (botsNode.isArray()) {
            botsNode.forEach(b -> bots.add(new BotState(
                    b.path("id").isInt() ? b.get("id").asInt() : null,
                    b.path("name").asText("")
            )));
        }
        room.replaceBots(bots);

        JsonNode counts = json.path("counts");
        room.withCounts(new RoomState.Counts(
                counts.path("players").asInt(0),
                counts.path("spectators").asInt(0)
        ));

        return room;
    }
}
