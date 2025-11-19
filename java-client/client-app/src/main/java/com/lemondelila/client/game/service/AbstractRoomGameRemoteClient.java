package com.lemondelila.client.game.service;

import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.user.model.ClientSession;

import java.io.IOException;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

/**
 * Base pour les services distants des jeux gérés par le moteur :
 * création de salles, ajout de bots, rafraîchissement d'état et envoi d'actions.
 */
public abstract class AbstractRoomGameRemoteClient<S, D> extends RemoteGameServiceSupport {

    private final RoomBotRemoteClient roomBots;
    private final String gameType;
    private final String gameDisplayName;
    private final String gamePath;
    private final Class<D> stateDtoType;

    protected AbstractRoomGameRemoteClient(RestClient restClient,
                                           TaskScheduler scheduler,
                                           ClientSession session,
                                           RoomBotRemoteClient roomBots,
                                           String gameType,
                                           String gameDisplayName,
                                           String gamePath,
                                           Class<D> stateDtoType) {
        super(restClient, scheduler, session);
        this.roomBots = Objects.requireNonNull(roomBots, "roomBots");
        this.gameType = Objects.requireNonNull(gameType, "gameType");
        this.gameDisplayName = Objects.requireNonNull(gameDisplayName, "gameDisplayName");
        this.gamePath = Objects.requireNonNull(gamePath, "gamePath");
        this.stateDtoType = Objects.requireNonNull(stateDtoType, "stateDtoType");
    }

    protected CompletableFuture<S> startRoom(int seats,
                                             int initialBots,
                                             SessionBuilder<D, S> builder) {
        int resolvedSeats = Math.max(2, seats);
        int resolvedBots = Math.max(0, initialBots);
        return supplyAsync(() -> createRoom(gameType, gameDisplayName, resolvedSeats))
                .thenCompose(roomId ->
                        addBotsForRoom(roomId, resolvedBots)
                                .thenCompose(ignored -> fetchState(roomId, builder)));
    }

    protected CompletableFuture<S> fetchState(int roomId,
                                              SessionBuilder<D, S> builder) {
        Objects.requireNonNull(builder, "builder");
        return supplyAsync(() -> {
            D dto = restClient.get(gamePath + "/rooms/" + roomId + "/state", stateDtoType);
            return builder.build(roomId, dto);
        });
    }

    protected CompletableFuture<S> sendAction(int roomId,
                                              Map<String, Object> payload,
                                              SessionBuilder<D, S> builder) {
        Objects.requireNonNull(builder, "builder");
        return supplyAsync(() -> {
            D dto = restClient.post(
                    gamePath + "/rooms/" + roomId + "/move",
                    payload,
                    stateDtoType
            );
            return builder.build(roomId, dto);
        });
    }

    protected CompletableFuture<Void> addBotsForRoom(int roomId, int botCount) {
        int target = Math.max(0, botCount);
        CompletableFuture<Void> chain = CompletableFuture.completedFuture(null);
        for (int i = 0; i < target; i++) {
            chain = chain.thenCompose(ignored ->
                    roomBots.addBot(roomId).thenApply(bot -> null));
        }
        return chain;
    }

    protected RoomBotRemoteClient roomBots() {
        return roomBots;
    }

    protected String gamePath() {
        return gamePath;
    }

    @FunctionalInterface
    protected interface SessionBuilder<D, S> {
        S build(int roomId, D dto) throws IOException;
    }
}
