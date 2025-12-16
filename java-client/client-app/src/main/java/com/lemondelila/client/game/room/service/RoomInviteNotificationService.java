package com.lemondelila.client.game.room.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.room.event.RoomInviteReceived;
import com.lemondelila.client.game.room.model.RoomInvite;
import com.lemondelila.client.notification.service.NotificationConnectionFactory;
import com.lemondelila.client.notification.transport.NotificationConnection;
import com.lemondelila.client.user.events.LoginSucceeded;
import com.lemondelila.client.user.events.UserLoggedOut;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Objects;

public final class RoomInviteNotificationService implements AutoCloseable {

    private static final Logger LOGGER = LoggerFactory.getLogger(RoomInviteNotificationService.class);

    private final DomainEventBus eventBus;
    private final NotificationConnectionFactory factory;
    private final EventSubscriptions subscriptions = new EventSubscriptions();
    private NotificationConnection current;

    @Inject
    public RoomInviteNotificationService(DomainEventBus eventBus,
                                         NotificationConnectionFactory factory) {
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.factory = Objects.requireNonNull(factory, "factory");
        subscriptions.subscribe(eventBus, LoginSucceeded.class, ev -> connect());
        subscriptions.subscribe(eventBus, UserLoggedOut.class, ev -> disconnect());
    }

    public void connect() {
        disconnect();
        try {
            current = factory.open();
            current.onMessage(this::handleMessage);
            current.onError(err -> LOGGER.warn("[notify] {}", err));
            current.connect();
        } catch (Exception ex) {
            LOGGER.warn("[notify] impossible d'ouvrir le canal notifications: {}", ex.getMessage());
        }
    }

    private void handleMessage(NotificationConnection.Envelope envelope) {
        if (envelope == null || envelope.type() == null) return;
        if (!"rooms.invite.received".equalsIgnoreCase(envelope.type())) {
            return;
        }
        RoomInvite invite = parseInvite(envelope.payload());
        if (invite != null) {
            eventBus.publish(new RoomInviteReceived(invite));
        }
    }

    private RoomInvite parseInvite(JsonNode payload) {
        if (payload == null || !payload.isObject()) return null;
        String invitationId = payload.path("invitationId").asText("");
        JsonNode room = payload.path("room");
        JsonNode from = payload.path("from");
        int roomId = room.path("id").asInt(-1);
        String roomName = room.path("name").asText("");
        String gameType = room.path("gameType").asText("");
        int maxPlayers = room.path("maxPlayers").asInt(0);
        String status = room.path("status").asText("");
        long expiresAt = payload.path("expiresAt").asLong(0);
        int fromUserId = from.path("id").asInt(-1);
        String fromUsername = from.path("username").asText("");
        if (invitationId.isBlank() || roomId <= 0) return null;
        return new RoomInvite(invitationId, roomId, roomName, gameType, maxPlayers, status, expiresAt, fromUserId, fromUsername);
    }

    public void disconnect() {
        if (current != null) {
            try {
                current.close();
            } catch (Exception ignored) {
            }
            current = null;
        }
    }

    @Override
    public void close() {
        subscriptions.close();
        disconnect();
    }
}

