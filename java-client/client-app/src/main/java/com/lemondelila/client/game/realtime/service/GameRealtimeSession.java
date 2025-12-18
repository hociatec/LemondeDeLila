package com.lemondelila.client.game.realtime.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.core.model.ActionRequest;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.service.GenericGameStateMapper;
import com.lemondelila.client.game.realtime.contract.GameWsTypes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;

/**
 * Session temps réel "game" (adapter fin au-dessus de RealtimeManager).
 * Le moteur WS est RealtimeManager + ChannelSubscription ; cette classe ne fait que router les messages.
 */
public final class GameRealtimeSession {

    private static final Logger LOGGER = LoggerFactory.getLogger(GameRealtimeSession.class);

    private final RealtimeManager realtime;
    private final GenericGameStateMapper stateMapper;

    public GameRealtimeSession(RealtimeManager realtime, GenericGameStateMapper stateMapper) {
        this.realtime = Objects.requireNonNull(realtime, "realtime");
        this.stateMapper = Objects.requireNonNull(stateMapper, "stateMapper");
    }

    public Subscription open(int roomId,
                             String gameType,
                             Consumer<GenericGameState> onState,
                             Consumer<String> onError,
                             Consumer<com.lemondelila.client.framework.network.ws.RealtimeGateway.ConnectionState> onConnection) {
        Subscription subscription = new Subscription(stateMapper, roomId, gameType, onState, onError);
        RealtimeManager.ChannelSubscription channel = realtime.openGameChannel(
                roomId,
                subscription::handleMessage,
                onConnection
        );
        subscription.attach(channel);
        subscription.join();
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

        void handleMessage(JsonNode node) {
            if (node == null || node.isMissingNode()) return;
            String type = node.path("type").asText("");
            switch (type) {
                case GameWsTypes.GAME_STATE -> {
                    if (onState != null) {
                        GenericGameState state = stateMapper.map(node.path("payload"));
                        onState.accept(state);
                    }
                }
                case GameWsTypes.ERROR -> {
                    if (onError != null) {
                        String msg = node.path("payload").path("message").asText("Erreur temps réel");
                        onError.accept(msg);
                    }
                }
                default -> {
                }
            }
        }

        public void join() {
            if (closed) return;
            send(GameWsTypes.GAME_JOIN, Map.of("roomId", roomId, "gameType", gameType));
        }

        public void requestState() {
            if (closed) return;
            send(GameWsTypes.GAME_STATE, Map.of("roomId", roomId, "gameType", gameType));
        }

        public void sendActions(List<ActionRequest> actions) {
            if (closed) return;
            LOGGER.info("[ws-game] send actions count={} room={} gameType={}",
                    actions == null ? 0 : actions.size(),
                    roomId,
                    gameType);
            send(GameWsTypes.GAME_ACTIONS, Map.of("roomId", roomId, "gameType", gameType, "actions", actions));
        }

        private void send(String type, Map<String, ?> payload) {
            RealtimeManager.ChannelSubscription active = channel;
            if (closed || active == null) return;
            active.send(type, payload);
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

