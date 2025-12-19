package com.lemondelila.client.game.room.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.network.realtime.AbstractRealtimeService;
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
import com.lemondelila.client.framework.network.ws.StandardRealtimeGateway.SocketClosed;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.Objects;

/**
 * Pousse les mises à jour de room via WebSocket et publie les évènements de jeu.
 */
public final class RoomRealtimeService extends AbstractRealtimeService<Integer, ChannelSubscription> {

    private static final Logger LOGGER = LoggerFactory.getLogger(RoomRealtimeService.class);

    private final DomainEventBus eventBus;
    private final RealtimeManager realtimeManager;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    private final Object lock = new Object();
    private Integer lastRoomId;

    @Inject
    public RoomRealtimeService(DomainEventBus eventBus,
                               RealtimeManager realtimeManager) {
        super("ws-room");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.realtimeManager = Objects.requireNonNull(realtimeManager, "realtimeManager");
        subscriptions.subscribe(eventBus, SocketClosed.class, this::onSocketClosed);
    }

    public AutoCloseable subscribe(int roomId) {
        synchronized (lock) {
            try {
                lastRoomId = roomId;
                return acquire(roomId);
                /*
                        roomId,
                        this::handleMessage,
                        state -> {
                            switch (state) {
                                case CONNECTED -> LOGGER.info("WS room connecté pour la table {}", roomId);
                                case CLOSED, FAILED -> LOGGER.warn("WS room déconnecté pour la table {}", roomId);
                                default -> { }
                            }
                        */
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
        int targetRoom;
        synchronized (lock) {
            int payloadRoomId = extractRoomId(payload);
            targetRoom = payloadRoomId > 0 ? payloadRoomId : (lastRoomId != null ? lastRoomId : 0);
            if (targetRoom > 0) {
                lastRoomId = targetRoom;
            }
        }
        if (targetRoom < 0) {
            return;
        }
        ensureConnectedTo(targetRoom);
        enqueueOrRun(conn -> conn.send(type, payload));
        /*
            int payloadRoomId = extractRoomId(payload);
            int targetRoom = payloadRoomId > 0 ? payloadRoomId : (lastRoomId != null ? lastRoomId : 0);
            boolean needReconnect = current == null || current.isClosed() || (targetRoom > 0 && !Objects.equals(lastRoomId, targetRoom));
            if (needReconnect) {
                try {
                    if (targetRoom > 0) {
                        lastRoomId = targetRoom;
                    }
                    current = realtimeManager.openRoomChannel(
                            targetRoom,
                            this::handleMessage,
                            state -> {
                                if (targetRoom <= 0) return;
                                if (state == RealtimeGateway.ConnectionState.CONNECTED) {
                                    LOGGER.info("WS room reconnecté automatiquement pour la table {}", targetRoom);
                                } else if (state == RealtimeGateway.ConnectionState.CLOSED
                                        || state == RealtimeGateway.ConnectionState.FAILED) {
                                    LOGGER.warn("WS room fermé pour la table {}", targetRoom);
                                }
                            });
                } catch (IllegalStateException ex) {
                    eventBus.publish(new RoomRealtimeFailed(targetRoom, clean(ex.getMessage())));
                    return;
                }
            }
            current.send(type, payload);
        */
    }

    @Override
    public void close() {
        subscriptions.close();
        super.close();
    }

    /**
     * Réinitialise le suivi de room (utilisé quand on quitte une table).
     */
    public void resetTracking() {
        synchronized (lock) {
            lastRoomId = null;
        }
    }

    @Override
    protected ChannelSubscription openConnection(Integer roomId, ConnectionCallbacks callbacks) {
        return realtimeManager.openRoomChannel(
                roomId,
                this::handleMessage,
                state -> {
                    switch (state) {
                        case CONNECTED -> callbacks.onConnected();
                        case CLOSED, FAILED -> callbacks.onDisconnected(true);
                        default -> {
                        }
                    }
                }
        );
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
            case "bot.added" -> publishBotAdded(roomId, payload.path("bot"));
            case "bot.removed" -> publishBotRemoved(roomId, payload);
            case "room.privacy" -> publishRoomPrivacyChanged(roomId, payload);
            case "state-updated" -> publishStateUpdated(roomId, payload);
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

    private void publishStateUpdated(int roomId, JsonNode payload) {
        eventBus.publish(new com.lemondelila.client.game.room.event.GameStateUpdated(roomId));
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

    private void onSocketClosed(SocketClosed evt) {
        if (evt == null) return;
        String reason = evt.reason() == null ? "" : evt.reason().trim();
        LOGGER.warn("WS room fermé (code={}, reason='{}')", evt.statusCode(), reason);
    }

    private int extractRoomId(Map<String, ?> payload) {
        if (payload == null) {
            return 0;
        }
        Object candidate = payload.get("roomId");
        if (candidate instanceof Number) {
            return ((Number) candidate).intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(candidate));
        } catch (Exception ex) {
            LOGGER.debug("[ws-room] invalid roomId payload candidate={} err={}", candidate, ex.getMessage());
            return 0;
        }
    }
}
