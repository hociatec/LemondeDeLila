package com.lemondelila.client.gamelogic.missionnemesis.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.game.model.GameSessionManager;
import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisEngine;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;
import com.lemondelila.client.user.model.ClientSession;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

public final class NemesisRemoteClient
        implements GameSessionManager<NemesisSession, NemesisRemoteClient.Command> {

    private final NemesisSessionStore sessionStore;
    private final NemesisApiGateway apiGateway;
    private final NemesisSessionMapper sessionMapper;

    @Inject
    public NemesisRemoteClient(RestClient restClient,
                               TaskScheduler scheduler,
                               ClientSession session,
                               NemesisEngine engine,
                               NemesisSessionStore sessionStore) {
        this.sessionStore = Objects.requireNonNull(sessionStore, "sessionStore");
        Objects.requireNonNull(restClient, "restClient");
        Objects.requireNonNull(scheduler, "scheduler");
        Objects.requireNonNull(session, "session");
        Objects.requireNonNull(engine, "engine");
        this.apiGateway = new NemesisApiGateway(restClient, scheduler, session, engine);
        this.sessionMapper = new NemesisSessionMapper(engine, session);
    }

    @Override
    public CompletableFuture<NemesisSession> startNewGame() {
        return apiGateway.startNewGame()
                .thenApply(snapshot -> saveSnapshot(snapshot.roomId(), snapshot.state()));
    }

    @Override
    public CompletableFuture<NemesisSession> refresh(int roomId) {
        return apiGateway.refreshState(roomId)
                .thenApply(state -> saveSnapshot(roomId, state));
    }

    public CompletableFuture<NemesisSession> placeFleet(int roomId, List<ShipPlacement> placements) {
        return apiGateway.placeFleet(roomId, placements)
                .thenApply(state -> saveSnapshot(roomId, state));
    }

    public CompletableFuture<NemesisSession> fire(int roomId, GridCoordinate coordinate) {
        return apiGateway.fire(roomId, coordinate)
                .thenApply(state -> saveSnapshot(roomId, state));
    }

    @Override
    public CompletableFuture<NemesisSession> apply(int roomId, Command action) {
        return switch (action) {
            case Command.PlaceFleet placeFleet -> placeFleet(roomId, placeFleet.placements());
            case Command.Fire fire -> fire(roomId, fire.coordinate());
        };
    }

    public NemesisSession mapSession(int roomId, NemesisState state) {
        return sessionMapper.map(roomId, state);
    }

    private NemesisSession saveSnapshot(int roomId, NemesisState state) {
        NemesisSession session = sessionMapper.map(roomId, state);
        sessionStore.save(session);
        return session;
    }

    public sealed interface Command permits Command.PlaceFleet, Command.Fire {
        record PlaceFleet(List<ShipPlacement> placements) implements Command { }
        record Fire(GridCoordinate coordinate) implements Command { }
    }
}
