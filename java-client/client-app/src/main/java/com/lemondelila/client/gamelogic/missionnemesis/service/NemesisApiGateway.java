package com.lemondelila.client.gamelogic.missionnemesis.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.game.service.RemoteGameServiceSupport;
import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisEngine;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSpecs;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisStateMapper;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;
import com.lemondelila.client.user.model.ClientSession;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

final class NemesisApiGateway extends RemoteGameServiceSupport {

    private static final String GAME_PATH = "games/mission-nemesis";
    private static final String DISPLAY_NAME = "Mission Nemesis";

    private final NemesisEngine engine;

    NemesisApiGateway(RestClient restClient,
                      TaskScheduler scheduler,
                      ClientSession session,
                      NemesisEngine engine) {
        super(restClient, scheduler, session);
        this.engine = Objects.requireNonNull(engine, "engine");
    }

    CompletableFuture<StateSnapshot> startNewGame() {
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            int roomId = createRoom(engine.type(), DISPLAY_NAME, 2, headers);
            NemesisState state = fetchStateInternal(roomId, headers);
            return new StateSnapshot(roomId, state);
        });
    }

    CompletableFuture<NemesisState> refreshState(int roomId) {
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            return fetchStateInternal(roomId, headers);
        });
    }

    CompletableFuture<NemesisState> placeFleet(int roomId, List<ShipPlacement> placements) {
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            return sendMove(roomId, headers, Map.of(
                    "action", "place_ships",
                    "ships", encodePlacements(placements)
            ));
        });
    }

    CompletableFuture<NemesisState> fire(int roomId, GridCoordinate coordinate) {
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            return sendMove(roomId, headers, Map.of(
                    "action", "fire",
                    "coordinates", Map.of("x", coordinate.x(), "y", coordinate.y())
            ));
        });
    }

    private NemesisState fetchStateInternal(int roomId,
                                            Map<String, String> headers) throws IOException, InterruptedException {
        JsonNode node = restClient.get(GAME_PATH + "/rooms/" + roomId + "/state", headers);
        return NemesisStateMapper.fromJson(node);
    }

    private NemesisState sendMove(int roomId,
                                  Map<String, String> headers,
                                  Map<String, Object> payload) throws IOException, InterruptedException {
        JsonNode node = restClient.post(GAME_PATH + "/rooms/" + roomId + "/move", headers, payload);
        return NemesisStateMapper.fromJson(node);
    }

    private List<Map<String, Object>> encodePlacements(List<ShipPlacement> placements) {
        List<Map<String, Object>> payload = new ArrayList<>();
        placements.stream()
                .filter(placement -> NemesisSpecs.ships().containsKey(placement.name()))
                .forEach(placement -> {
                    List<Map<String, Integer>> coords = new ArrayList<>();
                    placement.coordinates().forEach(coordinate ->
                            coords.add(Map.of("x", coordinate.x(), "y", coordinate.y()))
                    );
                    payload.add(Map.of(
                            "name", placement.name(),
                            "coords", coords
                    ));
                });
        return payload;
    }

    record StateSnapshot(int roomId, NemesisState state) { }
}
