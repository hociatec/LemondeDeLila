package com.lemondelila.client.gamelogic.panierexpress.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressStateMapper;
import com.lemondelila.client.model.game.GameSessionManager;
import com.lemondelila.client.model.user.ClientSession;
import com.lemondelila.client.service.game.RemoteGameServiceSupport;
import com.lemondelila.framework.core.di.Inject;
import com.lemondelila.framework.core.task.TaskScheduler;
import com.lemondelila.framework.network.rest.RestClient;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public final class PanierExpressRemoteClient extends RemoteGameServiceSupport
        implements GameSessionManager<PanierExpressSession, PanierExpressRemoteClient.Command> {

    private static final String GAME_PATH = "games/panier-express";

    @Inject
    public PanierExpressRemoteClient(RestClient restClient,
                                     TaskScheduler scheduler,
                                     ClientSession session) {
        super(restClient, scheduler, session);
    }

    @Override
    public CompletableFuture<PanierExpressSession> startNewGame() {
        return startNewGame(PanierExpressGameOptions.defaults());
    }

    public CompletableFuture<PanierExpressSession> startNewGame(PanierExpressGameOptions options) {
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            int robotCount = options == null ? PanierExpressGameOptions.DEFAULT_ROBOT_COUNT : options.robotCount();
            int seats = Math.max(1, Math.min(robotCount + 1, 6));
            int roomId = createRoom("panier-express", "Panier Express", seats, headers);
            PanierExpressState state = fetchStateInternal(roomId, headers);
            return new PanierExpressSession(roomId, state);
        });
    }

    public CompletableFuture<PanierExpressSession> refresh(int roomId) {
        return supplyAsync(() -> {
            PanierExpressState state = fetchStateInternal(roomId, authHeaders());
            return new PanierExpressSession(roomId, state);
        });
    }

    public CompletableFuture<PanierExpressSession> roll(int roomId) {
        return sendAction(roomId, Map.of("action", "roll"));
    }

    public CompletableFuture<PanierExpressSession> answerQuiz(int roomId, int choice) {
        return sendAction(roomId, Map.of(
                "action", "answer_quiz",
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
            JsonNode node = restClient.post(GAME_PATH + "/rooms/" + roomId + "/move", authHeaders(), payload);
            PanierExpressState state = PanierExpressStateMapper.fromJson(node);
            return new PanierExpressSession(roomId, state);
        });
    }

    private PanierExpressState fetchStateInternal(int roomId,
                                                  Map<String, String> headers) throws IOException, InterruptedException {
        JsonNode node = restClient.get(GAME_PATH + "/rooms/" + roomId + "/state", headers);
        return PanierExpressStateMapper.fromJson(node);
    }

    public sealed interface Command permits Command.Roll, Command.AnswerQuiz, Command.Refresh {
        record Roll() implements Command {}
        record AnswerQuiz(int choice) implements Command {}
        record Refresh() implements Command {}
    }
}
