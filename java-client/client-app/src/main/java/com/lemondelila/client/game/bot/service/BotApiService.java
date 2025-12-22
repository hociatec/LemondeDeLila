package com.lemondelila.client.game.bot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.network.RealtimeApiClient;
import com.lemondelila.client.game.room.model.BotState;

import java.io.IOException;
import java.util.Map;

public final class BotApiService {

    private final RealtimeApiClient apiClient;

    public BotApiService(RealtimeApiClient apiClient) {
        this.apiClient = apiClient;
    }

    public BotState addBot(int roomId) throws IOException, InterruptedException {
        JsonNode json = apiClient.request("bot.add", Map.of("roomId", roomId), JsonNode.class);
        JsonNode botNode = json.path("bot");
        if (!botNode.isObject()) {
            return null;
        }
        Integer id = botNode.path("id").isInt() ? botNode.get("id").asInt() : null;
        String botName = botNode.path("name").asText("");
        return new BotState(id, botName);
    }

    public void removeBot(int roomId, int botId) throws IOException, InterruptedException {
        apiClient.request("bot.remove", Map.of("roomId", roomId, "botId", botId), JsonNode.class);
    }
}
