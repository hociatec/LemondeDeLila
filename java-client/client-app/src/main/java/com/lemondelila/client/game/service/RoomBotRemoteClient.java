package com.lemondelila.client.game.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.game.service.dto.RoomBotCreateResponseDto;
import com.lemondelila.client.game.service.dto.RoomBotDto;
import com.lemondelila.client.game.service.dto.RoomDetailsDto;
import com.lemondelila.client.user.model.ClientSession;

import java.io.IOException;
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
            RoomBotCreateResponseDto response = restClient.post(
                    "rooms/" + roomId + "/bots",
                    Map.of(),
                    RoomBotCreateResponseDto.class
            );
            RoomBotDto bot = response == null ? null : response.bot();
            if (bot == null || bot.id() <= 0 || bot.name() == null || bot.name().isBlank()) {
                throw new IOException("Réponse bot invalide");
            }
            return new RoomBotInfo(bot.id(), bot.name());
        });
    }

    public CompletableFuture<List<RoomBotInfo>> listBots(int roomId) {
        return supplyAsync(() -> {
            RoomDetailsDto response = restClient.get("rooms/" + roomId, RoomDetailsDto.class);
            if (response == null || response.bots() == null || response.bots().isEmpty()) {
                return List.of();
            }
            return response.bots().stream()
                    .filter(bot -> bot.id() > 0 && bot.name() != null && !bot.name().isBlank())
                    .map(bot -> new RoomBotInfo(bot.id(), bot.name()))
                    .toList();
        });
    }

    public CompletableFuture<Void> removeBot(int roomId, int botId) {
        return supplyAsync(() -> {
            restClient.delete("rooms/" + roomId + "/bots/" + botId);
            return null;
        });
    }

    public record RoomBotInfo(int id, String name) {
    }
}
