package com.lemondelila.client.game.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.user.model.ClientSession;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public final class RoomBotRemoteClient extends RemoteGameServiceSupport {

    @Inject
    public RoomBotRemoteClient(RestClient restClient,
                               TaskScheduler scheduler,
                               ClientSession session) {
        super(restClient, scheduler, session);
    }

    public CompletableFuture<RoomBotInfo> addBot(int roomId) {
        return supplyAsync(() -> {
            JsonNode response = restClient.post(
                    "rooms/" + roomId + "/bots",
                    authHeaders(),
                    Map.of()
            );
            JsonNode botNode = response.path("bot");
            if (!botNode.isObject()) {
                throw new IOException("Réponse bot invalide");
            }
            return new RoomBotInfo(
                    botNode.path("id").asInt(-1),
                    botNode.path("name").asText("")
            );
        });
    }

    public CompletableFuture<List<RoomBotInfo>> listBots(int roomId) {
        return supplyAsync(() -> {
            JsonNode response = restClient.get("rooms/" + roomId, authHeaders());
            List<RoomBotInfo> bots = new ArrayList<>();
            for (JsonNode botNode : response.withArray("bots")) {
                bots.add(new RoomBotInfo(
                        botNode.path("id").asInt(-1),
                        botNode.path("name").asText("")
                ));
            }
            return bots;
        });
    }

    public CompletableFuture<Void> removeBot(int roomId, int botId) {
        return supplyAsync(() -> {
            restClient.delete("rooms/" + roomId + "/bots/" + botId, authHeaders());
            return null;
        });
    }

    public record RoomBotInfo(int id, String name) {
    }
}
