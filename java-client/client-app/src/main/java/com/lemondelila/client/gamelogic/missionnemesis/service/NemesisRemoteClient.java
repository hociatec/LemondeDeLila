package com.lemondelila.client.gamelogic.missionnemesis.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisEngine;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSpecs;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisStateMapper;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;
import com.lemondelila.client.game.model.GameSessionManager;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.game.service.RemoteGameServiceSupport;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

public final class NemesisRemoteClient extends RemoteGameServiceSupport
        implements GameSessionManager<NemesisSession, NemesisRemoteClient.Command> {

    private static final String GAME_PATH = "games/mission-nemesis";
    private static final String DISPLAY_NAME = "Mission Nemesis";

    private final NemesisEngine engine;
    private final NemesisSessionStore sessionStore;

    @Inject
    public NemesisRemoteClient(RestClient restClient,
                                      TaskScheduler scheduler,
                                      ClientSession session,
                                      NemesisEngine engine,
                                      NemesisSessionStore sessionStore) {
        super(restClient, scheduler, session);
        this.engine = Objects.requireNonNull(engine, "engine");
        this.sessionStore = Objects.requireNonNull(sessionStore, "sessionStore");
    }

    @Override
    public CompletableFuture<NemesisSession> startNewGame() {
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            int roomId = createRoom(engine.type(), DISPLAY_NAME, 2, headers);
            NemesisState state = fetchStateInternal(roomId, headers);
            NemesisSession session = mapSession(roomId, state);
            sessionStore.save(session);
            return session;
        });
    }

    @Override
    public CompletableFuture<NemesisSession> refresh(int roomId) {
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            NemesisState state = fetchStateInternal(roomId, headers);
            NemesisSession session = mapSession(roomId, state);
            sessionStore.save(session);
            return session;
        });
    }

    public CompletableFuture<NemesisSession> placeFleet(int roomId, List<ShipPlacement> placements) {
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            NemesisState state = sendMove(roomId, headers, Map.of(
                    "action", "place_ships",
                    "ships", encodePlacements(placements)
            ));
            NemesisSession session = mapSession(roomId, state);
            sessionStore.save(session);
            return session;
        });
    }

    public CompletableFuture<NemesisSession> fire(int roomId, GridCoordinate coordinate) {
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            NemesisState state = sendMove(roomId, headers, Map.of(
                    "action", "fire",
                    "coordinates", Map.of("x", coordinate.x(), "y", coordinate.y())
            ));
            NemesisSession session = mapSession(roomId, state);
            sessionStore.save(session);
            return session;
        });
    }

    @Override
    public CompletableFuture<NemesisSession> apply(int roomId, Command action) {
        return switch (action) {
            case Command.PlaceFleet placeFleet -> placeFleet(roomId, placeFleet.placements());
            case Command.Fire fire -> fire(roomId, fire.coordinate());
        };
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

    public NemesisSession mapSession(int roomId, NemesisState state) {
        String username = session.authenticated()
                .map(ClientSession.AuthState::username)
                .orElse(null);
        NemesisState.Player self = null;
        int selfIndex = -1;
        List<NemesisState.Player> players = state.players();
        if (username != null) {
            for (int i = 0; i < players.size(); i++) {
                NemesisState.Player player = players.get(i);
                if (username.equalsIgnoreCase(player.username())) {
                    self = player;
                    selfIndex = i;
                    break;
                }
            }
        }
        return new NemesisSession(roomId, state, self, selfIndex, engine.score(state));
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

    public sealed interface Command permits Command.PlaceFleet, Command.Fire {
        record PlaceFleet(List<ShipPlacement> placements) implements Command {}
        record Fire(GridCoordinate coordinate) implements Command {}
    }
}
