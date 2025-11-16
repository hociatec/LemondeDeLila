package com.lemondelila.client.game.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.core.config.ConfigurationService;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;
import com.lemondelila.client.framework.network.ws.StandardRealtimeGateway;
import com.lemondelila.client.framework.network.channel.GameRealtimeChannel;
import com.lemondelila.client.framework.network.channel.RealtimeChannel;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.user.model.ClientSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.charset.StandardCharsets;
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
    private volatile Integer activeRoomId;
    private volatile String activeToken;

    public TokenAwareRealtimeGateway(HttpClient httpClient,
                                     ObjectMapper objectMapper,
                                     DomainEventBus eventBus,
                                     URI baseUri,
                                     ClientSession session,
                                     Supplier<Optional<Integer>> roomIdSupplier) {
        this.session = Objects.requireNonNull(session, "session");
        this.roomIdSupplier = Objects.requireNonNull(roomIdSupplier, "roomIdSupplier");
        this.channel = new GameRealtimeChannel(() -> baseUri);
        this.delegate = new StandardRealtimeGateway(
                httpClient,
                () -> channel.resolve(activeToken, activeRoomId),
                objectMapper,
                eventBus
        );
    }

    @Inject
    public TokenAwareRealtimeGateway(HttpClient httpClient,
                                     ObjectMapper objectMapper,
                                     DomainEventBus eventBus,
                                     ConfigurationService configurationService,
                                     ClientSession session,
                                     NemesisSessionStore store) {
        this.session = Objects.requireNonNull(session, "session");
        this.roomIdSupplier = () -> store.current().map(NemesisSession::roomId);
        this.channel = new GameRealtimeChannel(configurationService);
        this.delegate = new StandardRealtimeGateway(
                httpClient,
                () -> channel.resolve(activeToken, activeRoomId),
                objectMapper,
                eventBus
        );
    }

    private URI buildEndpoint() {
        Optional<ClientSession.AuthState> auth = session.authenticated();
        if (auth.isEmpty()) {
            return baseUri;
        }
        String token = auth.get().token();
        if (token == null || token.isBlank()) {
            return baseUri;
        }
        String encoded = URLEncoder.encode(token, StandardCharsets.UTF_8);
        StringBuilder uriBuilder = new StringBuilder(baseUri.toString());
        char separator = uriBuilder.indexOf("?") >= 0 ? '&' : '?';
        uriBuilder.append(separator).append("token=").append(encoded);
        Integer room = activeRoomId;
        if (room != null) {
            uriBuilder.append('&').append("room=").append(room);
        }
        return URI.create(uriBuilder.toString());
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
