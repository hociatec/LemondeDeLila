package com.lemondelila.client.gamelogic.damenature.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureConfig;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureEngine;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSession;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSessionStore;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureState;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureStateMapper;
import com.lemondelila.client.model.game.GameSessionManager;
import com.lemondelila.client.model.user.ClientSession;
import com.lemondelila.client.service.game.RemoteGameServiceSupport;
import com.lemondelila.framework.core.di.Inject;
import com.lemondelila.framework.core.task.TaskScheduler;
import com.lemondelila.framework.network.rest.RestClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

public final class DameNatureRemoteClient extends RemoteGameServiceSupport
        implements GameSessionManager<DameNatureSession, DameNatureRemoteClient.Command> {

    private static final String GAME_PATH = "games/dame-nature";
    private static final String DISPLAY_NAME = "Dame Nature";

    private static final Logger LOGGER = LoggerFactory.getLogger(DameNatureRemoteClient.class);

    private final DameNatureEngine engine;
    private final DameNatureSessionStore sessionStore;
    private final LocalDameNatureService localFallback;

    @Inject
    public DameNatureRemoteClient(RestClient restClient,
                                  TaskScheduler scheduler,
                                  ClientSession session,
                                  DameNatureEngine engine,
                                  DameNatureSessionStore sessionStore,
                                  LocalDameNatureService localFallback) {
        super(restClient, scheduler, session);
        this.engine = Objects.requireNonNull(engine, "engine");
        this.sessionStore = Objects.requireNonNull(sessionStore, "sessionStore");
        this.localFallback = Objects.requireNonNull(localFallback, "localFallback");
    }

    @Override
    public CompletableFuture<DameNatureSession> startNewGame() {
        return startNewGame(DameNatureConfig.defaultConfig());
    }

    public CompletableFuture<DameNatureSession> startNewGame(DameNatureConfig configuration) {
        Objects.requireNonNull(configuration, "configuration");
        CompletableFuture<DameNatureSession> remote = supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            int roomId = createRoom(engine.type(), DISPLAY_NAME, 4, headers);
            DameNatureState state = fetchStateInternal(roomId, headers);
            DameNatureSession session = mapSession(roomId, state);
            sessionStore.save(session);
            return session;
        });
        return withFallback(remote, () -> localFallback.startNewGame(this.session, configuration));
    }

    @Override
    public CompletableFuture<DameNatureSession> refresh(int roomId) {
        CompletableFuture<DameNatureSession> remote = supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            DameNatureState state = fetchStateInternal(roomId, headers);
            DameNatureSession session = mapSession(roomId, state);
            sessionStore.save(session);
            return session;
        });
        return withFallback(remote, () -> localFallback.refresh(roomId, this.session));
    }

    public CompletableFuture<DameNatureSession> askCard(int roomId,
                                                        int targetId,
                                                        String familyId,
                                                        String memberId) {
        CompletableFuture<DameNatureSession> remote = supplyAsync(() -> {
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
        return withFallback(remote, () -> localFallback.askCard(roomId, this.session, targetId, familyId, memberId));
    }

    public CompletableFuture<DameNatureSession> draw(int roomId) {
        CompletableFuture<DameNatureSession> remote = supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            DameNatureState state = sendMove(roomId, headers, Map.of(
                    "action", "draw"
            ));
            DameNatureSession session = mapSession(roomId, state);
            sessionStore.save(session);
            return session;
        });
        return withFallback(remote, () -> localFallback.draw(roomId, this.session));
    }

    public CompletableFuture<DameNatureSession> answerQuiz(int roomId, int choice) {
        CompletableFuture<DameNatureSession> remote = supplyAsync(() -> {
            Map<String, String> headers = authHeaders();
            DameNatureState state = sendMove(roomId, headers, Map.of(
                    "action", "answer_quiz",
                    "choice", choice
            ));
            DameNatureSession session = mapSession(roomId, state);
            sessionStore.save(session);
            return session;
        });
        return withFallback(remote, () -> localFallback.answerQuiz(roomId, this.session, choice));
    }

    @Override
    public CompletableFuture<DameNatureSession> apply(int roomId, Command command) {
        return switch (command) {
            case Command.AskCard ask ->
                    askCard(roomId, ask.targetId(), ask.familyId(), ask.memberId());
            case Command.Draw draw ->
                    draw(roomId);
            case Command.AnswerQuiz answer ->
                    answerQuiz(roomId, answer.choice());
            case Command.Refresh ignore ->
                    refresh(roomId);
        };
    }

    private DameNatureState fetchStateInternal(int roomId,
                                               Map<String, String> headers) throws IOException, InterruptedException {
        JsonNode node = restClient.get(GAME_PATH + "/rooms/" + roomId + "/state", headers);
        return DameNatureStateMapper.fromJson(node);
    }

    private DameNatureState sendMove(int roomId,
                                     Map<String, String> headers,
                                     Map<String, Object> payload) throws IOException, InterruptedException {
        JsonNode node = restClient.post(GAME_PATH + "/rooms/" + roomId + "/move", headers, payload);
        return DameNatureStateMapper.fromJson(node);
    }

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

    private CompletableFuture<DameNatureSession> withFallback(CompletableFuture<DameNatureSession> remoteFuture,
                                                              java.util.function.Supplier<CompletableFuture<DameNatureSession>> fallbackSupplier) {
        CompletableFuture<DameNatureSession> result = new CompletableFuture<>();
        remoteFuture.whenComplete((sessionResult, error) -> {
            if (error == null) {
                result.complete(sessionResult);
                return;
            }
            Throwable cause = unwrap(error);
            LOGGER.warn("Service Dame Nature distant indisponible, passage en mode local : {}", cause.getMessage());
            CompletableFuture<DameNatureSession> fallback = fallbackSupplier.get();
            fallback.whenComplete((fallbackResult, fallbackError) -> {
                if (fallbackError == null) {
                    result.complete(fallbackResult);
                } else {
                    result.completeExceptionally(fallbackError);
                }
            });
        });
        return result;
    }

    private static Throwable unwrap(Throwable error) {
        Throwable current = error;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current;
    }

    public sealed interface Command permits Command.AskCard, Command.Draw, Command.AnswerQuiz, Command.Refresh {
        record AskCard(int targetId, String familyId, String memberId) implements Command {}
        record Draw() implements Command {}
        record AnswerQuiz(int choice) implements Command {}
        record Refresh() implements Command {}
    }
}
