package com.lemondelila.client.game.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.network.channel.GameRealtimeChannel;
import com.lemondelila.client.framework.network.channel.RealtimeChannel;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;
import com.lemondelila.client.framework.network.ws.StandardRealtimeGateway;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.game.service.ActiveRoomTracker;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class TokenAwareRealtimeGateway implements RealtimeGateway {

    private static final Logger LOGGER = LoggerFactory.getLogger(TokenAwareRealtimeGateway.class);

    private final ClientSession session;
    private final Supplier<Optional<Integer>> roomIdSupplier;
    private final StandardRealtimeGateway delegate;
    private final RealtimeChannel channel;
    private final URI baseUri;
    private final RealtimeSignatureService signatureService;
    private volatile Integer activeRoomId;
    private volatile String activeToken;

    public TokenAwareRealtimeGateway(HttpClient httpClient,
                                     ObjectMapper objectMapper,
                                     DomainEventBus eventBus,
                                     URI baseUri,
                                     ClientSession session,
                                     Supplier<Optional<Integer>> roomIdSupplier,
                                     RealtimeSignatureService signatureService) {
        this.session = Objects.requireNonNull(session, "session");
        this.roomIdSupplier = Objects.requireNonNull(roomIdSupplier, "roomIdSupplier");
        this.baseUri = Objects.requireNonNull(baseUri, "baseUri");
        this.channel = new GameRealtimeChannel(() -> baseUri);
        this.signatureService = Objects.requireNonNull(signatureService, "signatureService");
        this.delegate = new StandardRealtimeGateway(
                httpClient,
                () -> channel.resolve(activeToken, activeRoomId, buildSignatureParams()),
                objectMapper,
                eventBus
        );
    }

    @Inject
    public TokenAwareRealtimeGateway(HttpClient httpClient,
                                     ObjectMapper objectMapper,
                                     DomainEventBus eventBus,
                                     NetworkEndpoints endpoints,
                                     ClientSession session,
                                     ActiveRoomTracker roomTracker,
                                     RealtimeSignatureService signatureService) {
        this.session = Objects.requireNonNull(session, "session");
        this.roomIdSupplier = () -> roomTracker.currentRoom();
        this.baseUri = endpoints.realtimeGateway();
        this.channel = new GameRealtimeChannel(endpoints);
        this.signatureService = Objects.requireNonNull(signatureService, "signatureService");
        this.delegate = new StandardRealtimeGateway(
                httpClient,
                () -> channel.resolve(activeToken, activeRoomId, buildSignatureParams()),
                objectMapper,
                eventBus
        );
    }

    private Map<String, String> buildSignatureParams() {
        if (signatureService == null) {
            return Map.of();
        }
        Optional<ClientSession.AuthState> auth = session.authenticated();
        if (auth.isEmpty()) {
            return Map.of();
        }
        String token = auth.get().token();
        if (token == null || token.isBlank()) {
            return Map.of();
        }
        long timestamp = System.currentTimeMillis() / 1_000L;
        String signature = signatureService.sign(token, activeRoomId, timestamp);
        return Map.of("ts", Long.toString(timestamp), "sig", signature);
    }

    @Override
    public void connect() {
        Optional<ClientSession.AuthState> auth = session.authenticated();
        if (auth.isEmpty()) {
            if (activeRoomId != null) {
                delegate.disconnect(WebSocket.NORMAL_CLOSURE, "unauthenticated");
                activeRoomId = null;
            }
            LOGGER.debug("Connexion WS ignoree : aucun token disponible.");
            return;
        }

        Optional<Integer> suppliedRoom;
        try {
            Optional<Integer> room = roomIdSupplier.get();
            suppliedRoom = room != null ? room : Optional.empty();
        } catch (Exception ex) {
            LOGGER.warn("Impossible de determiner la table active pour la connexion WS", ex);
            return;
        }

        if (suppliedRoom.isEmpty()) {
            if (activeRoomId != null) {
                delegate.disconnect(WebSocket.NORMAL_CLOSURE, "room-cleared");
                activeRoomId = null;
            }
            LOGGER.debug("Connexion WS ignoree : aucune table active.");
            return;
        }

        Integer targetRoom = suppliedRoom.get();
        Integer currentRoom = activeRoomId;
        if (currentRoom != null && currentRoom.equals(targetRoom)) {
            LOGGER.trace("Connexion WS deja active pour la table {}", targetRoom);
            return;
        }

        if (currentRoom != null && !currentRoom.equals(targetRoom)) {
            delegate.disconnect(WebSocket.NORMAL_CLOSURE, "switch-room");
        }

        activeToken = auth.get().token();
        activeRoomId = targetRoom;
        delegate.connect();
    }

    @Override
    public void disconnect(int statusCode, String reason) {
        activeRoomId = null;
        activeToken = null;
        delegate.disconnect(statusCode, reason);
    }

    @Override
    public void send(JsonNode payload) {
        delegate.send(payload);
    }

    @Override
    public void onMessage(Consumer<JsonNode> handler) {
        delegate.onMessage(handler);
    }

    @Override
    public void onConnectionState(Consumer<ConnectionState> handler) {
        delegate.onConnectionState(handler);
    }

    @Override
    public void close() {
        activeRoomId = null;
        activeToken = null;
        delegate.close();
    }
}
