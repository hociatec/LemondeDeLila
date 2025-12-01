package com.lemondelila.client.game.room.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.room.model.RoomState;

final class RoomMapper {

    private RoomMapper() {
    }

    static RoomState mapRoom(JsonNode json) {
        RoomState room = new RoomState()
                .withId(json.path("id").isInt() ? json.get("id").asInt() : null)
                .withName(json.path("name").asText(""))
                .withStatus(json.path("status").asText(""))
                .withGameType(json.path("gameType").asText(""))
                .withIsPrivate(json.path("isPrivate").asBoolean(true))
                .withMaxPlayers(json.path("maxPlayers").asInt(0));

        JsonNode owner = json.path("owner");
        if (owner.isObject()) {
            room.withOwner(new RoomState.Owner(
                    owner.path("id").isInt() ? owner.get("id").asInt() : null,
                    owner.path("username").asText("")
            ));
        }

        JsonNode playersNode = json.path("players");
        room.replacePlayers(RoomParticipantsMapper.mapPlayers(playersNode));

        JsonNode botsNode = json.path("bots");
        room.replaceBots(RoomParticipantsMapper.mapBots(botsNode));

        JsonNode counts = json.path("counts");
        room.withCounts(new RoomState.Counts(
                counts.path("players").asInt(0),
                counts.path("spectators").asInt(0)
        ));

        return room;
    }
}
