package com.lemondelila.client.gamelogic.panierexpress.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressStateMapper;
import com.lemondelila.client.gamelogic.panierexpress.service.dto.PanierExpressStateDto;
import com.lemondelila.client.game.model.GameSessionManager;
import com.lemondelila.client.game.service.AbstractRoomGameRemoteClient;
import com.lemondelila.client.game.service.RoomBotRemoteClient;
import com.lemondelila.client.user.model.ClientSession;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public final class PanierExpressRemoteClient extends AbstractRoomGameRemoteClient<PanierExpressSession, PanierExpressStateDto>
        implements GameSessionManager<PanierExpressSession, PanierExpressRemoteClient.Command> {

    private static final String GAME_PATH = "games/panier-express";
    private static final String ACTION_ROLL = "roll";
    private static final String ACTION_ANSWER_QUIZ = "answer_quiz";

    @Inject
    public PanierExpressRemoteClient(RestClient restClient,
                                     TaskScheduler scheduler,
                                     ClientSession session,
                                     RoomBotRemoteClient roomBots) {
        super(restClient,
                scheduler,
                session,
                roomBots,
                "panier-express",
                "Panier Express",
                GAME_PATH,
                PanierExpressStateDto.class);
    }

    @Override
    public CompletableFuture<PanierExpressSession> startNewGame() {
        return startNewGame(PanierExpressGameOptions.defaults());
    }

    public CompletableFuture<PanierExpressSession> startNewGame(PanierExpressGameOptions options) {
        PanierExpressGameOptions resolved = options == null
                ? PanierExpressGameOptions.defaults()
                : options;
        int requestedBots = Math.min(resolved.robotCount(), PanierExpressGameOptions.MAX_ROBOT_COUNT);
        int seats = Math.max(2, Math.min(requestedBots + 1, 6));
        return startRoom(seats, requestedBots, this::buildSession);
    }

    public CompletableFuture<PanierExpressSession> refresh(int roomId) {
        return fetchState(roomId, this::buildSession);
    }

    public CompletableFuture<PanierExpressSession> roll(int roomId) {
        return sendAction(roomId, Map.of("action", ACTION_ROLL), this::buildSession);
    }

    public CompletableFuture<PanierExpressSession> answerQuiz(int roomId, int choice) {
        return sendAction(roomId, Map.of(
                "action", ACTION_ANSWER_QUIZ,
                "choice", choice
        ), this::buildSession);
    }

    @Override
    public CompletableFuture<PanierExpressSession> apply(int roomId, Command command) {
        return switch (command) {
            case Command.Roll roll -> roll(roomId);
            case Command.Refresh refresh -> refresh(roomId);
            case Command.AnswerQuiz answer -> answerQuiz(roomId, answer.choice());
        };
    }

    private PanierExpressSession buildSession(int roomId, PanierExpressStateDto dto) throws IOException {
        return new PanierExpressSession(roomId, PanierExpressStateMapper.fromDto(dto), null);
    }

    public sealed interface Command permits Command.Roll, Command.AnswerQuiz, Command.Refresh {
        record Roll() implements Command {}
        record AnswerQuiz(int choice) implements Command {}
        record Refresh() implements Command {}
    }
}
