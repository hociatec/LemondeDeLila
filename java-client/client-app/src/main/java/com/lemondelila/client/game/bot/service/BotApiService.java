package com.lemondelila.client.game.bot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.game.room.model.BotState;

import java.io.IOException;
import java.util.Map;

public final class BotApiService {

    private final RestClient restClient;

    public BotApiService(RestClient restClient) {
        this.restClient = restClient;
    }

    public BotState addBot(int roomId, String name) throws IOException, InterruptedException {
        JsonNode json = restClient.post("rooms/" + roomId + "/bots", Map.of("name", name == null ? "" : name));
        JsonNode botNode = json.path("bot");
        if (!botNode.isObject()) {
            return null;
        }
        Integer id = botNode.path("id").isInt() ? botNode.get("id").asInt() : null;
        String botName = botNode.path("name").asText(name == null ? "" : name);
        return new BotState(id, botName);
    }

    public void removeBot(int roomId, int botId) throws IOException, InterruptedException {
        restClient.delete("rooms/" + roomId + "/bots/" + botId);
    }
}
