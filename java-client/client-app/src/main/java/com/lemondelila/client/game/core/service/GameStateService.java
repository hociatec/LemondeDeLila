package com.lemondelila.client.game.core.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.core.action.ActionRequest;
import com.lemondelila.client.game.core.mapper.GenericGameStateMapper;
import com.lemondelila.client.game.core.model.GenericGameState;

import java.io.IOException;
import java.util.List;

public final class GameStateService {

    private final GameActionService actions;
    private final GenericGameStateMapper mapper;

    public GameStateService(GameActionService actions, GenericGameStateMapper mapper) {
        this.actions = actions;
        this.mapper = mapper;
    }

    public GenericGameState fetchState(String gameType, int roomId) throws IOException, InterruptedException {
        JsonNode json = actions.fetchState(gameType, roomId);
        return mapper.map(json);
    }

    public GenericGameState sendActions(String gameType, int roomId, List<ActionRequest> actionRequests) throws IOException, InterruptedException {
        JsonNode json = actions.sendActions(gameType, roomId, actionRequests);
        return mapper.map(json);
    }
}
