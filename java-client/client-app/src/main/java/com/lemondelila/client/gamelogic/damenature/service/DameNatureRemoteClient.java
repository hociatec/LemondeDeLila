package com.lemondelila.client.gamelogic.damenature.service;

import com.lemondelila.client.gamelogic.damenature.dto.DameNatureStateDto;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureConfig;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureEngine;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSession;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSessionStore;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureState;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureStateMapper;
import com.lemondelila.client.game.model.GameSessionManager;
import com.lemondelila.client.game.service.RoomBotRemoteClient;
import com.lemondelila.client.game.service.RemoteGameServiceSupport;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.user.model.ClientSession;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

public final class DameNatureRemoteClient extends RemoteGameServiceSupport
        implements GameSessionManager<DameNatureSession, DameNatureRemoteClient.Command> {

    private static final String GAME_PATH = "games/dame-nature";
    private static final String DISPLAY_NAME = "Dame Nature";

    private final DameNatureEngine engine;
    private final DameNatureSessionStore sessionStore;
    private final RoomBotRemoteClient roomBots;

    @Inject
    public DameNatureRemoteClient(RestClient restClient,
                                  TaskScheduler scheduler,
                                  ClientSession session,
                                  DameNatureEngine engine,
                                  DameNatureSessionStore sessionStore,
                                  RoomBotRemoteClient roomBots) {
        super(restClient, scheduler, session);
        this.engine = Objects.requireNonNull(engine, "engine");
        this.sessionStore = Objects.requireNonNull(sessionStore, "sessionStore");
        this.roomBots = Objects.requireNonNull(roomBots, "roomBots");
    }

    @Override
    public CompletableFuture<DameNatureSession> startNewGame() {
        return startNewGame(DameNatureConfig.defaultConfig());
    }

    public CompletableFuture<DameNatureSession> startNewGame(DameNatureConfig configuration) {
        Objects.requireNonNull(configuration, "configuration");
        int requestedBots = Math.max(0, Math.min(configuration.botCount(), 5));
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            int seats = Math.max(2, Math.min(1 + requestedBots, 6));
            int roomId = createRoom(engine.type(), DISPLAY_NAME, seats, headers);
            return new RoomSetup(roomId, requestedBots);
        }).thenCompose(setup ->
                addBotsForRoom(setup.roomId(), setup.botCount())
                        .thenCompose(ignored -> supplyAsync(() -> {
                            Map<String, String> headers = authHeaders();
                            DameNatureState state = fetchStateInternal(setup.roomId(), headers);
                            DameNatureSession session = mapSession(setup.roomId(), state);
                            sessionStore.save(session);
                            return session;
                        }))
        );
    }

    @Override
    public CompletableFuture<DameNatureSession> refresh(int roomId) {
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            DameNatureState state = fetchStateInternal(roomId, headers);
            DameNatureSession session = mapSession(roomId, state);
            sessionStore.save(session);
            return session;
        });
    }

    public CompletableFuture<DameNatureSession> askCard(int roomId,
                                                        int targetId,
                                                        String familyId,
                                                        String memberId) {
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            DameNatureState state = sendMove(roomId, headers, Map.of(
                    "action", "ask_card",
                    "target", targetId,
                    "familyId", familyId,
                    "memberId", memberId
            ));
            DameNatureSession session = mapSession(roomId, state);
            sessionStore.save(session);
            return session;
        });
    }

    public CompletableFuture<DameNatureSession> draw(int roomId) {
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            DameNatureState state = sendMove(roomId, headers, Map.of("action", "draw"));
            DameNatureSession session = mapSession(roomId, state);
            sessionStore.save(session);
            return session;
        });
    }

    public CompletableFuture<DameNatureSession> answerQuiz(int roomId, int choice) {
        return supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            DameNatureState state = sendMove(roomId, headers, Map.of(
                    "action", "answer_quiz",
                    "choice", choice
            ));
            DameNatureSession session = mapSession(roomId, state);
            sessionStore.save(session);
            return session;
        });
    }

    @Override
    public CompletableFuture<DameNatureSession> apply(int roomId, Command command) {
        return switch (command) {
            case Command.AskCard ask -> askCard(roomId, ask.targetId(), ask.familyId(), ask.memberId());
            case Command.Draw draw -> draw(roomId);
            case Command.AnswerQuiz answer -> answerQuiz(roomId, answer.choice());
            case Command.Refresh ignore -> refresh(roomId);
        };
    }

    private DameNatureState fetchStateInternal(int roomId,
                                               Map<String, String> headers) throws IOException, InterruptedException {
        DameNatureStateDto dto = restClient.get(
                GAME_PATH + "/rooms/" + roomId + "/state",
                headers,
                DameNatureStateDto.class
        );
        return DameNatureStateMapper.fromDto(dto);
    }

    private DameNatureState sendMove(int roomId,
                                     Map<String, String> headers,
                                     Map<String, Object> payload) throws IOException, InterruptedException {
        DameNatureStateDto dto = restClient.post(
                GAME_PATH + "/rooms/" + roomId + "/move",
                headers,
                payload,
                DameNatureStateDto.class
        );
        return DameNatureStateMapper.fromDto(dto);
    }

    private CompletableFuture<Void> addBotsForRoom(int roomId, int botCount) {
        int target = Math.max(0, Math.min(botCount, 5));
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

    public DameNatureSession mapSession(int roomId, DameNatureState state) {
        String username = session.authenticated()
                .map(ClientSession.AuthState::username)
                .orElse(null);
        DameNatureState.Player self = null;
        int selfIndex = -1;
        List<DameNatureState.Player> players = state.players();
        for (int i = 0; i < players.size(); i++) {
            DameNatureState.Player player = players.get(i);
            if (username != null && username.equalsIgnoreCase(player.username())) {
                self = player;
                selfIndex = i;
                break;
            }
        }
        return new DameNatureSession(roomId, state, self, selfIndex, engine.score(state));
    }

    public sealed interface Command permits Command.AskCard, Command.Draw, Command.AnswerQuiz, Command.Refresh {
        record AskCard(int targetId, String familyId, String memberId) implements Command {}
        record Draw() implements Command {}
        record AnswerQuiz(int choice) implements Command {}
        record Refresh() implements Command {}
    }
}
