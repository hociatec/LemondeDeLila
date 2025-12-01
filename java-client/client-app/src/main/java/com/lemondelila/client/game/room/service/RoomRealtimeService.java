package com.lemondelila.client.game.room.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.game.bot.event.BotAdded;
import com.lemondelila.client.game.bot.event.BotOperationFailed;
import com.lemondelila.client.game.bot.event.BotRemoved;
import com.lemondelila.client.game.realtime.service.RealtimeManager;
import com.lemondelila.client.game.realtime.service.RealtimeManager.ChannelSubscription;
import com.lemondelila.client.game.room.event.RoomCreated;
import com.lemondelila.client.game.room.event.RoomOperationFailed;
import com.lemondelila.client.game.room.event.RoomRealtimeEvent;
import com.lemondelila.client.game.room.event.RoomRealtimeFailed;
import com.lemondelila.client.game.room.event.RoomUpdated;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.RoomState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.Objects;

/**
 * Pousse les mises à jour de room via WebSocket et publie les évènements de jeu.
 */
public final class RoomRealtimeService implements AutoCloseable {

    private static final Logger LOGGER = LoggerFactory.getLogger(RoomRealtimeService.class);

    private final DomainEventBus eventBus;
    private final RealtimeManager realtimeManager;

    private final Object lock = new Object();
    private ChannelSubscription current;

    @Inject
    public RoomRealtimeService(DomainEventBus eventBus,
                               RealtimeManager realtimeManager) {
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.realtimeManager = Objects.requireNonNull(realtimeManager, "realtimeManager");
    }

    public AutoCloseable subscribe(int roomId) {
        synchronized (lock) {
            closeCurrent();
            try {
                current = realtimeManager.openRoomChannel(roomId, this::handleMessage);
                return current;
            } catch (IllegalStateException ex) {
                String reason = clean(ex.getMessage());
                LOGGER.debug("Impossible de souscrire à la room {} : {}", roomId, reason);
                eventBus.publish(new RoomRealtimeFailed(roomId, reason));
                return () -> { };
            }
        }
    }

    public void sendCommand(String type, Map<String, ?> payload) {
        Objects.requireNonNull(type, "type");
        synchronized (lock) {
            if (current == null || current.isClosed()) {
                try {
                    current = realtimeManager.openRoomChannel(0, this::handleMessage);
                } catch (IllegalStateException ex) {
                    eventBus.publish(new RoomRealtimeFailed(0, clean(ex.getMessage())));
                    return;
                }
            }
            current.send(type, payload);
        }
    }

    @Override
    public void close() {
        synchronized (lock) {
            closeCurrent();
        }
    }

    private void closeCurrent() {
        if (current != null) {
            try {
                current.close();
            } catch (Exception e) {
                LOGGER.debug("Erreur en fermant la subscription WS", e);
            }
            current = null;
        }
    }

    private void handleMessage(JsonNode message) {
        if (!message.isObject()) {
            return;
        }
        JsonNode payload = message.path("payload");
        if (!payload.isObject()) {
            return;
        }
        JsonNode roomNode = payload.path("room");
        RoomState room = null;
        if (roomNode.isObject()) {
            try {
                room = RoomMapper.mapRoom(roomNode);
            } catch (Exception ex) {
                LOGGER.warn("Impossible de décoder l'état room", ex);
            }
        }
        int roomId = -1;
        if (message.path("roomId").isInt()) {
            roomId = message.get("roomId").asInt();
        } else if (room != null && room.id() != null) {
            roomId = room.id();
        } else if (payload.path("roomId").isInt()) {
            roomId = payload.get("roomId").asInt();
        } else if (payload.path("id").isInt()) {
            roomId = payload.get("id").asInt();
        }
        if (room != null) {
            eventBus.publish(new RoomRealtimeEvent(room, message));
            eventBus.publish(new RoomUpdated(room));
        }
        String type = message.path("type").asText("");
        switch (type) {
            case "room.created" -> publishRoomCreated(roomId, room, payload);
            case "bot.added", "bot-added" -> publishBotAdded(roomId, payload.path("bot"));
            case "bot.removed", "bot-removed" -> publishBotRemoved(roomId, payload);
            case "room.privacy" -> publishRoomPrivacyChanged(roomId, payload);
            case "error" -> publishOperationFailed(payload.path("message").asText("Erreur temps réel"));
            default -> { }
        }
    }

    private void publishBotAdded(int roomId, JsonNode botNode) {
        BotState bot = mapBot(botNode);
        if (bot != null) {
            eventBus.publish(new BotAdded(roomId, bot));
        }
    }

    private void publishBotRemoved(int roomId, JsonNode payload) {
        BotState bot = mapBot(payload.path("bot"));
        if (bot != null) {
            Integer id = bot.id();
            eventBus.publish(new BotRemoved(roomId, id != null ? id : -1, bot.name()));
            return;
        }
        JsonNode idNode = payload.path("botId");
        Integer botId = extractBotId(idNode);
        if (botId != null) {
            eventBus.publish(new BotRemoved(roomId, botId, null));
        }
    }

    private void publishOperationFailed(String message) {
        String clean = clean(message);
        eventBus.publish(new RoomOperationFailed(clean));
    }

    private void publishRoomPrivacyChanged(int roomId, JsonNode payload) {
        boolean isPrivate = payload.path("isPrivate").asBoolean(true);
        eventBus.publish(new com.lemondelila.client.game.room.event.RoomPrivacyChanged(roomId, isPrivate));
    }

    private static BotState mapBot(JsonNode node) {
        if (!node.isObject()) {
            return null;
        }
        Integer id = null;
        JsonNode idNode = node.get("id");
        if (idNode != null) {
            if (idNode.isInt()) {
                id = idNode.asInt();
            } else if (idNode.isTextual()) {
                try {
                    id = Integer.valueOf(idNode.asText());
                } catch (NumberFormatException ignored) {
                    id = null;
                }
            }
        }
        String name = node.path("name").asText("");
        return new BotState(id, name);
    }

    private void publishRoomCreated(int roomId, RoomState room, JsonNode payload) {
        RoomState state = room;
        if (state == null && roomId > 0) {
            state = new RoomState().withId(roomId);
            String gameType = payload != null ? payload.path("gameType").asText(null) : null;
            if ((gameType == null || gameType.isBlank()) && payload != null && payload.path("room").isObject()) {
                gameType = payload.path("room").path("gameType").asText(null);
            }
            if (gameType != null && !gameType.isBlank()) {
                state.withGameType(gameType);
            }
            String name = payload != null ? payload.path("name").asText(null) : null;
            if ((name == null || name.isBlank()) && payload != null && payload.path("room").isObject()) {
                name = payload.path("room").path("name").asText(null);
            }
            if (name != null && !name.isBlank()) {
                state.withName(name);
            }
        }
        if (state != null && state.id() != null) {
            eventBus.publish(new RoomCreated(state));
        }
    }

    private static Integer extractBotId(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return null;
        }
        if (node.isInt()) {
            return node.asInt();
        }
        if (node.isTextual()) {
            try {
                return Integer.valueOf(node.asText());
            } catch (NumberFormatException ignored) {
            }
        }
        return null;
    }

    private static String clean(String message) {
        if (message == null) {
            return "Erreur temps réel";
        }
        return message.replaceAll("\\s+", " ").trim();
    }
}
