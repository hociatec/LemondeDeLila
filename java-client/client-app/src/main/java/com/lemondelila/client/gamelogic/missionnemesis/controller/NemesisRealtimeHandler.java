package com.lemondelila.client.gamelogic.missionnemesis.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisStateMapper;
import com.lemondelila.client.gamelogic.missionnemesis.service.NemesisRemoteClient;
import org.slf4j.Logger;

import java.io.IOException;

final class NemesisRealtimeHandler {

    private final RealtimeGateway realtimeGateway;
    private final NemesisRemoteClient remoteClient;
    private final NemesisSessionCoordinator sessionCoordinator;
    private final String gameType;
    private final Logger logger;

    NemesisRealtimeHandler(RealtimeGateway realtimeGateway,
                           NemesisRemoteClient remoteClient,
                           NemesisSessionCoordinator sessionCoordinator,
                           String gameType,
                           Logger logger) {
        this.realtimeGateway = realtimeGateway;
        this.remoteClient = remoteClient;
        this.sessionCoordinator = sessionCoordinator;
        this.gameType = gameType;
        this.logger = logger;
        this.realtimeGateway.onMessage(this::handleRealtimeMessage);
    }

    private void handleRealtimeMessage(JsonNode message) {
        if (message == null) {
            return;
        }
        if (!"state-updated".equalsIgnoreCase(message.path("type").asText())) {
            return;
        }
        int roomId = message.path("roomId").asInt(-1);
        if (roomId <= 0 || !sessionCoordinator.isTrackedRoom(roomId)) {
            return;
        }
        JsonNode payload = message.path("payload");
        if (!payload.isObject()) {
            return;
        }
        String resolvedGameType = payload.path("score").path("type")
                .asText(payload.path("room").path("gameType").asText(""));
        if (!gameType.equalsIgnoreCase(resolvedGameType)) {
            return;
        }
        JsonNode gameStateNode = payload.path("gameState");
        if (!gameStateNode.isObject()) {
            return;
        }
        try {
            NemesisState state = NemesisStateMapper.fromJson(gameStateNode);
            NemesisSession session = remoteClient.mapSession(roomId, state);
            sessionCoordinator.updateSession(session);
        } catch (IOException ex) {
            logger.warn("Impossible d'interpreter la mise a jour temps reel Mission Nemesis", ex);
        }
    }
}
