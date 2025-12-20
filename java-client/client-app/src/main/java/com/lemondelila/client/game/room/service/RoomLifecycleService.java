package com.lemondelila.client.game.room.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.bot.event.BotAdded;
import com.lemondelila.client.game.bot.event.BotOperationFailed;
import com.lemondelila.client.game.bot.event.BotRemoved;
import com.lemondelila.client.game.room.event.RoomOperationFailed;
import com.lemondelila.client.game.room.event.RoomCreated;
import com.lemondelila.client.game.room.event.RoomRealtimeEvent;
import com.lemondelila.client.game.room.event.RoomRealtimeFailed;
import com.lemondelila.client.game.room.event.RoomUpdated;
import com.lemondelila.client.game.room.event.RoomRoleChanged;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.RoomState;
import com.lemondelila.client.game.room.model.TableState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Objects;

/**
 * Synchronise les états de table avec le flux temps réel et expose la logique de tracking.
 */
public final class RoomLifecycleService implements AutoCloseable {

    private static final Logger LOGGER = LoggerFactory.getLogger(RoomLifecycleService.class);

    private final TableState tableState;
    private final DomainEventBus eventBus;
    private final RoomRealtimeService realtimeService;
    private final RoomDetailsState detailsState;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    private final Object lock = new Object();
    private AutoCloseable realtimeSubscription;
    private Integer observedRoomId;

    @Inject
    public RoomLifecycleService(TableState tableState,
                                DomainEventBus eventBus,
                                RoomRealtimeService realtimeService,
                                RoomDetailsState detailsState) {
        this.tableState = tableState;
        this.eventBus = eventBus;
        this.realtimeService = realtimeService;
        this.detailsState = detailsState;

        subscriptions.subscribe(eventBus, RoomRealtimeEvent.class, this::onRealtimeEvent);
        subscriptions.subscribe(eventBus, RoomUpdated.class, this::onRoomUpdated);
        subscriptions.subscribe(eventBus, BotAdded.class, this::onBotAdded);
        subscriptions.subscribe(eventBus, BotRemoved.class, this::onBotRemoved);
        subscriptions.subscribe(eventBus, BotOperationFailed.class, e -> { });
        subscriptions.subscribe(eventBus, RoomOperationFailed.class, e -> { });
        subscriptions.subscribe(eventBus, RoomCreated.class, this::onRoomCreated);
        subscriptions.subscribe(eventBus, RoomRoleChanged.class, this::onRoleChanged);
    }

    public void trackRoom(Integer roomId, String gameType) {
        synchronized (lock) {
            if (Objects.equals(roomId, observedRoomId)) {
                return;
            }
            closeRealtimeSubscription();
            observedRoomId = roomId;
            if (roomId == null) {
                // Réinitialiser explicitement l'état local pour éviter de conserver des bots/flags d'une ancienne table.
                tableState.clear();
                detailsState.setRoomId(null);
                detailsState.setGameType(null);
                detailsState.setRoomName(null);
                detailsState.setSpectator(false);
                realtimeService.resetTracking();
                return;
            }
            tableState.setRoom(roomId, gameType);
            if (!Objects.equals(detailsState.roomId(), roomId)) {
                detailsState.setRoomId(roomId);
                detailsState.setRoomName(null);
            }
            if (gameType != null && !gameType.isBlank()) {
                detailsState.setGameType(gameType);
            }
            try {
                realtimeSubscription = realtimeService.subscribe(roomId, detailsState.spectator());
            } catch (Exception ex) {
                String reason = "Impossible d'ouvrir la connexion temps réel";
                LOGGER.warn(reason, ex);
                eventBus.publish(new RoomRealtimeFailed(roomId, detail(reason)));
            }
        }
    }

    public void stopTracking() {
        trackRoom(null, null);
    }

    @Override
    public void close() {
        subscriptions.close();
        closeRealtimeSubscription();
    }

    private void onRealtimeEvent(RoomRealtimeEvent event) {
        RoomState room = event.room();
        if (room.id() == null) {
            return;
        }
        updateStateFromRoom(room);
    }

    private void onRoomUpdated(RoomUpdated event) {
        RoomState room = event.room();
        if (room.id() == null) {
            return;
        }
        if (observedRoomId != null && !observedRoomId.equals(room.id())) {
            return;
        }
        updateStateFromRoom(room);
    }

    private void onRoomCreated(RoomCreated event) {
        RoomState room = event.room();
        if (room == null || room.id() == null) {
            return;
        }
        // Dès qu'on reçoit la création, on suit la room pour alimenter TableState et bots/players.
        trackRoom(room.id(), room.gameType());
        updateStateFromRoom(room);
        detailsState.setRoomId(room.id());
        detailsState.setGameType(room.gameType());
        detailsState.setRoomName(room.name());
        detailsState.setSpectator(false);
    }

    private void onBotAdded(BotAdded event) {
        if (observedRoomId == null || event.roomId() != observedRoomId) {
            return;
        }
        tableState.addBot(event.bot());
    }

    private void onBotRemoved(BotRemoved event) {
        if (observedRoomId == null || event.roomId() != observedRoomId) {
            return;
        }
        tableState.removeBot(event.botId());
    }

    private void updateStateFromRoom(RoomState room) {
        tableState.setRoom(room.id(), room.gameType());
        tableState.updateBots(room.bots());
        tableState.updatePlayers(room.players());
        tableState.updateStatus(room.status());
        tableState.updatePrivacy(room.isPrivate());
        RoomState.Owner owner = room.owner().orElse(null);
        tableState.updateOwner(owner != null ? owner.id() : null, owner != null ? owner.username() : null);
        detailsState.setRoomId(room.id());
        detailsState.setGameType(room.gameType());
        detailsState.setRoomName(room.name());
    }

    private void closeRealtimeSubscription() {
        synchronized (lock) {
            if (realtimeSubscription != null) {
                try {
                    realtimeSubscription.close();
                } catch (Exception ex) {
                    LOGGER.debug("Erreur lors de la fermeture de la connexion temps réel", ex);
                }
                realtimeSubscription = null;
            }
            observedRoomId = null;
        }
    }

    private static String detail(String message) {
        if (message == null || message.isBlank()) {
            return "Erreur temps réel";
        }
        return message;
    }

    private void onRoleChanged(RoomRoleChanged event) {
        if (event == null) {
            return;
        }
        Integer current = detailsState.roomId();
        if (current == null || current != event.roomId()) {
            return;
        }
        detailsState.setSpectator(event.spectator());
    }
}
