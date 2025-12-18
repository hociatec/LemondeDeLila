package com.lemondelila.client.game.core.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;
import com.lemondelila.client.game.core.model.ActionRequest;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.realtime.service.RealtimeManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;

/**
 * Client WebSocket pour le moteur de jeu (/ws/game). Évite le polling HTTP.
 */
public final class GameRealtimeClient {

    private static final Logger LOGGER = LoggerFactory.getLogger(GameRealtimeClient.class);

    private final RealtimeManager realtime;
    private final GenericGameStateMapper stateMapper;

    public GameRealtimeClient(RealtimeManager realtime, GenericGameStateMapper stateMapper) {
        this.realtime = Objects.requireNonNull(realtime, "realtime");
        this.stateMapper = Objects.requireNonNull(stateMapper, "stateMapper");
    }

    public Subscription open(int roomId,
                             String gameType,
                             Consumer<GenericGameState> onState,
                             Consumer<String> onError) {
        Subscription subscription = new Subscription(stateMapper, roomId, gameType, onState, onError);
        RealtimeManager.ChannelSubscription channel = realtime.openGameChannel(
                roomId,
                subscription::handleMessage,
                state -> {
                    if (state == RealtimeGateway.ConnectionState.CONNECTED) {
                        LOGGER.info("[ws-game] connected room={} gameType={}", roomId, gameType);
                    } else {
                        LOGGER.info("[ws-game] state={} room={} gameType={}", state, roomId, gameType);
                    }
                }
        );
        subscription.attach(channel);
        subscription.start();
        return subscription;
    }

    public static final class Subscription implements AutoCloseable {
        private final GenericGameStateMapper stateMapper;
        private final int roomId;
        private final String gameType;
        private final Consumer<GenericGameState> onState;
        private final Consumer<String> onError;
        private volatile boolean closed;
        private volatile RealtimeManager.ChannelSubscription channel;

        Subscription(GenericGameStateMapper stateMapper,
                     int roomId,
                     String gameType,
                     Consumer<GenericGameState> onState,
                     Consumer<String> onError) {
            this.stateMapper = stateMapper;
            this.roomId = roomId;
            this.gameType = gameType;
            this.onState = onState;
            this.onError = onError;
        }

        void attach(RealtimeManager.ChannelSubscription channel) {
            this.channel = channel;
        }

        void start() {
            sendJoin();
        }

        void handleMessage(JsonNode node) {
            if (node == null || node.isMissingNode()) return;
            String type = node.path("type").asText("");
            switch (type) {
                case "game.state" -> {
                    if (onState != null) {
                        GenericGameState state = stateMapper.map(node.path("payload"));
                        LOGGER.debug("[ws-game] recv state status={} actions={} pending={}",
                                state.status(),
                                state.actions() == null ? 0 : state.actions().size(),
                                state.pending());
                        onState.accept(state);
                    }
                }
                case "error" -> {
                    if (onError != null) {
                        String msg = node.path("payload").path("message").asText("Erreur temps réel");
                        LOGGER.warn("[ws-game] recv error message={}", msg);
                        onError.accept(msg);
                    }
                }
                default -> {
                }
            }
        }

        public void requestState() {
            if (closed) return;
            LOGGER.debug("[ws-game] request state room={} gameType={}", roomId, gameType);
            send("game.state", Map.of("roomId", roomId, "gameType", gameType));
        }

        public void sendActions(List<ActionRequest> actions) {
            if (closed) return;
            LOGGER.info("[ws-game] send actions count={} room={} gameType={} types={}",
                    actions == null ? 0 : actions.size(),
                    roomId,
                    gameType,
                    describeActions(actions));
            send("game.actions", Map.of("roomId", roomId, "gameType", gameType, "actions", actions));
        }

        private void sendJoin() {
            LOGGER.info("[ws-game] join room={} gameType={}", roomId, gameType);
            send("game.join", Map.of("roomId", roomId, "gameType", gameType));
        }

        private void send(String type, Map<String, ?> payload) {
            RealtimeManager.ChannelSubscription active = channel;
            if (closed || active == null) return;
            active.send(type, payload);
        }

        private String describeActions(List<ActionRequest> actions) {
            if (actions == null || actions.isEmpty()) return "[]";
            return actions.stream()
                    .map(a -> a == null ? "null" : a.type())
                    .toList()
                    .toString();
        }

        @Override
        public void close() {
            closed = true;
            RealtimeManager.ChannelSubscription active = channel;
            if (active != null) {
                active.close();
            }
        }
    }
}

