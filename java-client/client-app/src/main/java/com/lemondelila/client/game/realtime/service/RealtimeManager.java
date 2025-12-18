package com.lemondelila.client.game.realtime.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.network.channel.GameRealtimeChannel;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import com.lemondelila.client.framework.network.realtime.RealtimeSignatureService;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;
import com.lemondelila.client.framework.network.ws.StandardRealtimeGateway;
import com.lemondelila.client.user.model.ClientSession;

import java.net.URI;
import java.net.http.HttpClient;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Queue;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Manager générique pour ouvrir des canaux temps réel et envoyer des commandes.
 */
public final class RealtimeManager {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final DomainEventBus eventBus;
    private final NetworkEndpoints endpoints;
    private final ClientSession session;
    private final RealtimeSignatureService signatureService;

    @Inject
    public RealtimeManager(HttpClient httpClient,
                           ObjectMapper objectMapper,
                           DomainEventBus eventBus,
                           NetworkEndpoints endpoints,
                           ClientSession session,
                           RealtimeSignatureService signatureService) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.endpoints = Objects.requireNonNull(endpoints, "endpoints");
        this.session = Objects.requireNonNull(session, "session");
        this.signatureService = Objects.requireNonNull(signatureService, "signatureService");
    }

    public ChannelSubscription openRoomChannel(Integer roomId,
                                               Consumer<JsonNode> handler,
                                               Consumer<RealtimeGateway.ConnectionState> onState) {
        return openChannel(endpoints::realtimeGateway, roomId, handler, Map.of(), true, onState);
    }

    public ChannelSubscription openChannel(Integer roomId,
                                           Consumer<JsonNode> handler,
                                           Map<String, String> extraParams,
                                           Consumer<RealtimeGateway.ConnectionState> onState) {
        return openChannel(endpoints::realtimeGateway, roomId, handler, extraParams, true, onState);
    }

    /**
     * Ouvre un canal vers le moteur de jeu (/ws/game).
     * Le backend attend le token en query param (auth WS) et le gameType dans le payload des messages (join/state/actions).
     */
    public ChannelSubscription openGameChannel(Integer roomId,
                                               Consumer<JsonNode> handler,
                                               Consumer<RealtimeGateway.ConnectionState> onState) {
        return openChannel(endpoints::gameGateway, roomId, handler, Map.of(), false, onState);
    }

    private ChannelSubscription openChannel(Supplier<URI> baseSupplier,
                                           Integer roomId,
                                           Consumer<JsonNode> handler,
                                           Map<String, String> extraParams,
                                           boolean includeSignature,
                                           Consumer<RealtimeGateway.ConnectionState> onState) {
        String token = requireToken();
        Map<String, String> params = new HashMap<>(extraParams == null ? Map.of() : extraParams);
        if (includeSignature) {
            String signature = signatureService.signature();
            if (signature != null && !signature.isBlank()) {
                params.put("signature", signature);
            }
        }
        Supplier<URI> supplier = () -> new GameRealtimeChannel(baseSupplier).resolve(token, roomId, params);
        StandardRealtimeGateway gateway = new StandardRealtimeGateway(httpClient, supplier, objectMapper, eventBus);
        ChannelSubscription subscription = new ChannelSubscription(gateway, objectMapper, onState);
        subscription.start(handler);
        return subscription;
    }

    private String requireToken() {
        Optional<ClientSession.AuthState> auth = session.authenticated();
        if (auth.isEmpty() || auth.get().token() == null || auth.get().token().isBlank()) {
            throw new IllegalStateException("Authentification requise pour le temps réel");
        }
        return auth.get().token();
    }

    public static final class ChannelSubscription implements AutoCloseable {

        private static final int PENDING_QUEUE_MAX = 200;

        private final StandardRealtimeGateway gateway;
        private final ObjectMapper mapper;
        private final Consumer<RealtimeGateway.ConnectionState> stateListener;
        private final Queue<ObjectNode> pendingMessages = new ConcurrentLinkedQueue<>();
        private volatile boolean connected;
        private volatile boolean closed;

        ChannelSubscription(StandardRealtimeGateway gateway,
                            ObjectMapper mapper,
                            Consumer<RealtimeGateway.ConnectionState> stateListener) {
            this.gateway = gateway;
            this.mapper = mapper;
            this.stateListener = stateListener;
        }

        void start(Consumer<JsonNode> handler) {
            gateway.onMessage(handler);
            gateway.onConnectionState(state -> {
                connected = state == RealtimeGateway.ConnectionState.CONNECTED;
                if (connected) {
                    flushPending();
                }
                if (stateListener != null) {
                    stateListener.accept(state);
                }
            });
            gateway.connect();
        }

        private void flushPending() {
            if (closed || !connected) {
                return;
            }
            ObjectNode next;
            while ((next = pendingMessages.poll()) != null) {
                try {
                    gateway.send(next);
                } catch (Exception ex) {
                    LOGGER.debug("[realtime] flushPending failed, will retry later: {}", ex.getMessage());
                    pendingMessages.offer(next);
                    break;
                }
            }
        }

        public void send(String type, Map<String, ?> payload) {
            if (closed) {
                throw new IllegalStateException("Canal temps réel fermé");
            }
            ObjectNode message = mapper.createObjectNode();
            message.put("type", type);
            if (payload == null || payload.isEmpty()) {
                message.set("payload", mapper.createObjectNode());
            } else {
                message.set("payload", mapper.valueToTree(payload));
            }

            if (connected) {
                gateway.send(message);
                return;
            }

            if (pendingMessages.size() >= PENDING_QUEUE_MAX) {
                pendingMessages.poll();
            }
            pendingMessages.offer(message);
            gateway.connect();
        }

        @Override
        public void close() {
            closed = true;
            pendingMessages.clear();
            gateway.close();
            connected = false;
        }

        public boolean isClosed() {
            return closed;
        }
    }
}
