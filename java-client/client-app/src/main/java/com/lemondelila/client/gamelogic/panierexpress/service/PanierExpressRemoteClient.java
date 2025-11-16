package com.lemondelila.client.gamelogic.panierexpress.service;

import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressStateMapper;
import com.lemondelila.client.gamelogic.panierexpress.dto.PanierExpressStateDto;
import com.lemondelila.client.game.model.GameSessionManager;
import com.lemondelila.client.game.service.RoomBotRemoteClient;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.game.service.RemoteGameServiceSupport;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;

import java.io.IOException;
import java.util.Objects;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public final class PanierExpressRemoteClient extends RemoteGameServiceSupport
        implements GameSessionManager<PanierExpressSession, PanierExpressRemoteClient.Command> {

    private static final String GAME_PATH = "games/panier-express";

    private final RoomBotRemoteClient roomBots;

    @Inject
    public PanierExpressRemoteClient(RestClient restClient,
                                     TaskScheduler scheduler,
                                     ClientSession session,
                                     RoomBotRemoteClient roomBots) {
        super(restClient, scheduler, session);
        this.roomBots = Objects.requireNonNull(roomBots, "roomBots");
    }

    @Override
    public CompletableFuture<PanierExpressSession> startNewGame() {
        return startNewGame(PanierExpressGameOptions.defaults());
    }

    public CompletableFuture<PanierExpressSession> startNewGame(PanierExpressGameOptions options) {
        int robots = options == null ? PanierExpressGameOptions.DEFAULT_ROBOT_COUNT : options.robotCount();
        int requestedBots = Math.max(PanierExpressGameOptions.MIN_ROBOT_COUNT,
                Math.min(PanierExpressGameOptions.MAX_ROBOT_COUNT, robots));
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            int seats = Math.max(2, Math.min(requestedBots + 1, 6));
            int roomId = createRoom("panier-express", "Panier Express", seats, headers);
            return new RoomSetup(roomId, requestedBots);
        }).thenCompose(setup ->
                addBotsForRoom(setup.roomId(), setup.botCount())
                        .thenCompose(ignored -> supplyAsync(() -> {
                            Map<String, String> headers = authHeaders();
                            PanierExpressState state = fetchStateInternal(setup.roomId(), headers);
                            return new PanierExpressSession(setup.roomId(), state);
                        }))
        );
    }

    public CompletableFuture<PanierExpressSession> refresh(int roomId) {
        return supplyAsync(() -> {
            PanierExpressState state = fetchStateInternal(roomId, authHeaders());
            return new PanierExpressSession(roomId, state);
        });
    }

    public CompletableFuture<PanierExpressSession> roll(int roomId) {
        return sendAction(roomId, Map.of("action", PanierExpressCommands.ROLL));
    }

    public CompletableFuture<PanierExpressSession> answerQuiz(int roomId, int choice) {
        return sendAction(roomId, Map.of(
                "action", PanierExpressCommands.ANSWER_QUIZ,
                "choice", choice
        ));
    }

    @Override
    public CompletableFuture<PanierExpressSession> apply(int roomId, Command command) {
        return switch (command) {
            case Command.Roll roll -> roll(roomId);
            case Command.Refresh refresh -> refresh(roomId);
            case Command.AnswerQuiz answer -> answerQuiz(roomId, answer.choice());
        };
    }

    private CompletableFuture<PanierExpressSession> sendAction(int roomId,
                                                               Map<String, Object> payload) {
        return supplyAsync(() -> {
            PanierExpressStateDto dto = restClient.post(
                    GAME_PATH + "/rooms/" + roomId + "/move",
                    authHeaders(),
                    payload,
                    PanierExpressStateDto.class
            );
            PanierExpressState state = PanierExpressStateMapper.fromDto(dto);
            return new PanierExpressSession(roomId, state);
        });
    }

    private PanierExpressState fetchStateInternal(int roomId,
                                                  Map<String, String> headers) throws IOException, InterruptedException {
        PanierExpressStateDto dto = restClient.get(
                GAME_PATH + "/rooms/" + roomId + "/state",
                headers,
                PanierExpressStateDto.class
        );
        return PanierExpressStateMapper.fromDto(dto);
    }

    private CompletableFuture<Void> addBotsForRoom(int roomId, int botCount) {
        int target = Math.max(0, Math.min(botCount, PanierExpressGameOptions.MAX_ROBOT_COUNT));
        if (target == 0) {
            return CompletableFuture.completedFuture(null);
        }
        CompletableFuture<Void> chain = CompletableFuture.completedFuture(null);
        for (int i = 0; i < target; i++) {
            chain = chain.thenCompose(ignored ->
                    roomBots.addBot(roomId).thenApply(added -> null));
        }
        return chain;
    }

    private record RoomSetup(int roomId, int botCount) { }

    public sealed interface Command permits Command.Roll, Command.AnswerQuiz, Command.Refresh {
        record Roll() implements Command {}
        record AnswerQuiz(int choice) implements Command {}
        record Refresh() implements Command {}
    }
}
