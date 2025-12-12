package com.lemondelila.client.game.core.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.network.channel.GameRealtimeChannel;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;
import com.lemondelila.client.framework.network.ws.StandardRealtimeGateway;
import com.lemondelila.client.game.core.model.ActionRequest;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.user.model.ClientSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Client WebSocket pour le moteur de jeu (/ws/game). Évite le polling HTTP.
 */
public final class GameRealtimeClient {

    private static final Logger LOGGER = LoggerFactory.getLogger(GameRealtimeClient.class);

    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final DomainEventBus eventBus;
    private final NetworkEndpoints endpoints;
    private final ClientSession session;
    private final GenericGameStateMapper stateMapper;

    public GameRealtimeClient(HttpClient httpClient,
                              ObjectMapper mapper,
                              DomainEventBus eventBus,
                              NetworkEndpoints endpoints,
                              ClientSession session,
                              GenericGameStateMapper stateMapper) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.mapper = Objects.requireNonNull(mapper, "mapper");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.endpoints = Objects.requireNonNull(endpoints, "endpoints");
        this.session = Objects.requireNonNull(session, "session");
        this.stateMapper = Objects.requireNonNull(stateMapper, "stateMapper");
    }

    public Subscription open(int roomId,
                             String gameType,
                             Consumer<GenericGameState> onState,
                             Consumer<String> onError) {
        String token = resolveToken();
        Supplier<URI> supplier = () -> new GameRealtimeChannel(endpoints::gameGateway)
                .resolve(token, roomId, Map.of("gameType", gameType));
        StandardRealtimeGateway gateway = new StandardRealtimeGateway(httpClient, supplier, mapper, eventBus);
        Subscription subscription = new Subscription(gateway, mapper, stateMapper, roomId, gameType, onState, onError);
        subscription.start();
        return subscription;
    }

    private String resolveToken() {
        Optional<ClientSession.AuthState> auth = session.authenticated();
        return auth.map(ClientSession.AuthState::token).orElse(null);
    }

    public static final class Subscription implements AutoCloseable {
        private final StandardRealtimeGateway gateway;
        private final ObjectMapper mapper;
        private final GenericGameStateMapper stateMapper;
        private final int roomId;
        private final String gameType;
        private final Consumer<GenericGameState> onState;
        private final Consumer<String> onError;
        private volatile boolean connected;
        private volatile boolean closed;

        Subscription(StandardRealtimeGateway gateway,
                     ObjectMapper mapper,
                     GenericGameStateMapper stateMapper,
                     int roomId,
                     String gameType,
                     Consumer<GenericGameState> onState,
                     Consumer<String> onError) {
            this.gateway = gateway;
            this.mapper = mapper;
            this.stateMapper = stateMapper;
            this.roomId = roomId;
            this.gameType = gameType;
            this.onState = onState;
            this.onError = onError;
        }

        void start() {
            gateway.onMessage(this::handleMessage);
            gateway.onConnectionState(state -> {
                connected = state == RealtimeGateway.ConnectionState.CONNECTED;
                if (connected) {
                    LOGGER.info("[ws-game] connected room={} gameType={}", roomId, gameType);
                    sendJoin();
                } else {
                    LOGGER.info("[ws-game] state={} room={} gameType={}", state, roomId, gameType);
                }
            });
            LOGGER.info("[ws-game] connecting room={} gameType={}", roomId, gameType);
            gateway.connect();
        }

        private void handleMessage(JsonNode node) {
            if (node == null || node.isMissingNode()) return;
            String type = node.path("type").asText("");
            switch (type) {
                case "game.state":
                    if (onState != null) {
                        GenericGameState state = stateMapper.map(node.path("payload"));
                        LOGGER.info("[ws-game] recv state status={} actions={} pending={}", state.status(), state.actions() == null ? 0 : state.actions().size(), state.pending());
                        onState.accept(state);
                    }
                    break;
                case "error":
                    if (onError != null) {
                        String msg = node.path("payload").path("message").asText("Erreur temps réel");
                        LOGGER.warn("[ws-game] recv error message={}", msg);
                        onError.accept(msg);
                    }
                    break;
                default:
                    break;
            }
        }

        public void requestState() {
            if (!connected || closed) return;
            LOGGER.debug("[ws-game] request state room={} gameType={}", roomId, gameType);
            send("game.state", Map.of("roomId", roomId, "gameType", gameType));
        }

        public void sendActions(List<ActionRequest> actions) {
            if (!connected || closed) return;
            LOGGER.info("[ws-game] send actions count={} room={} gameType={} types={}", actions == null ? 0 : actions.size(), roomId, gameType, describeActions(actions));
            send("game.actions", Map.of("roomId", roomId, "gameType", gameType, "actions", actions));
        }

        private void sendJoin() {
            LOGGER.info("[ws-game] join room={} gameType={}", roomId, gameType);
            send("game.join", Map.of("roomId", roomId, "gameType", gameType));
        }

        private void send(String type, Map<String, ?> payload) {
            if (closed) return;
            gateway.send(buildMessage(type, payload));
        }

        private JsonNode buildMessage(String type, Map<String, ?> payload) {
            Map<String, ?> safePayload = payload == null ? Map.of() : payload;
            return mapper.createObjectNode()
                    .put("type", type)
                    .set("payload", mapper.valueToTree(safePayload));
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
            gateway.close();
        }
    }
}
