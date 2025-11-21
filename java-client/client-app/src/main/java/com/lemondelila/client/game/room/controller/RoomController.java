package com.lemondelila.client.game.room.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.game.room.event.CreateRoomRequested;
import com.lemondelila.client.game.room.event.JoinRoomRequested;
import com.lemondelila.client.game.room.event.LeaveRoomRequested;
import com.lemondelila.client.game.room.event.RoomOperationFailed;
import com.lemondelila.client.game.room.event.RoomUpdated;
import com.lemondelila.client.game.room.event.StartRoomRequested;
import com.lemondelila.client.game.room.model.RoomState;
import com.lemondelila.client.game.room.service.RoomApiService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

public final class RoomController implements AutoCloseable {

    private static final Logger LOGGER = LoggerFactory.getLogger(RoomController.class);

    private final DomainEventBus eventBus;
    private final RoomApiService api;
    private final RoomAccessGuard guard;
    private final TaskScheduler scheduler;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public RoomController(DomainEventBus eventBus,
                          RoomApiService api,
                          RoomAccessGuard guard,
                          TaskScheduler scheduler) {
        this.eventBus = eventBus;
        this.api = api;
        this.guard = guard;
        this.scheduler = scheduler;
        subscriptions.subscribe(eventBus, CreateRoomRequested.class, this::onCreateRoom);
        subscriptions.subscribe(eventBus, JoinRoomRequested.class, this::onJoinRoom);
        subscriptions.subscribe(eventBus, LeaveRoomRequested.class, this::onLeaveRoom);
        subscriptions.subscribe(eventBus, StartRoomRequested.class, this::onStartRoom);
    }

    private void onCreateRoom(CreateRoomRequested req) {
        if (!guard.ensureAuthenticated()) {
            eventBus.publish(new RoomOperationFailed("Authentification requise pour créer une table"));
            return;
        }
        scheduler.runAsync(() -> {
            try {
                RoomState room = api.createRoom(req.name(), req.gameType(), req.maxPlayers(), req.isPrivate());
                eventBus.publish(new RoomUpdated(room));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (IOException e) {
                eventBus.publish(new RoomOperationFailed("Création impossible : " + clean(e.getMessage())));
            } catch (Exception e) {
                eventBus.publish(new RoomOperationFailed("Erreur création table : " + clean(e.getMessage())));
            }
        });
    }

    private void onJoinRoom(JoinRoomRequested req) {
        if (!guard.ensureAuthenticated()) {
            eventBus.publish(new RoomOperationFailed("Authentification requise pour rejoindre une table"));
            return;
        }
        scheduler.runAsync(() -> {
            try {
                api.joinRoom(req.roomId());
                RoomState state = api.fetchRoom(req.roomId());
                eventBus.publish(new RoomUpdated(state));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (IOException e) {
                eventBus.publish(new RoomOperationFailed("Impossible de rejoindre : " + clean(e.getMessage())));
            } catch (Exception e) {
                eventBus.publish(new RoomOperationFailed("Erreur rejoindre : " + clean(e.getMessage())));
            }
        });
    }

    private void onLeaveRoom(LeaveRoomRequested req) {
        if (!guard.ensureAuthenticated()) {
            eventBus.publish(new RoomOperationFailed("Authentification requise pour quitter une table"));
            return;
        }
        scheduler.runAsync(() -> {
            try {
                api.leaveRoom(req.roomId());
                RoomState state = api.fetchRoom(req.roomId());
                eventBus.publish(new RoomUpdated(state));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (IOException e) {
                eventBus.publish(new RoomOperationFailed("Impossible de quitter : " + clean(e.getMessage())));
            } catch (Exception e) {
                eventBus.publish(new RoomOperationFailed("Erreur quitter : " + clean(e.getMessage())));
            }
        });
    }

    private void onStartRoom(StartRoomRequested req) {
        if (!guard.ensureAuthenticated()) {
            eventBus.publish(new RoomOperationFailed("Authentification requise pour démarrer une table"));
            return;
        }
        scheduler.runAsync(() -> {
            try {
                api.startRoom(req.roomId());
                RoomState state = api.fetchRoom(req.roomId());
                eventBus.publish(new RoomUpdated(state));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (IOException e) {
                eventBus.publish(new RoomOperationFailed("Impossible de démarrer : " + clean(e.getMessage())));
            } catch (Exception e) {
                eventBus.publish(new RoomOperationFailed("Erreur démarrage : " + clean(e.getMessage())));
            }
        });
    }

    @Override
    public void close() {
        subscriptions.close();
    }

    private static String clean(String message) {
        if (message == null) return "erreur";
        return message.replaceAll("\\s+", " ").trim();
    }
}
