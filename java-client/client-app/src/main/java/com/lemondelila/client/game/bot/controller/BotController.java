package com.lemondelila.client.game.bot.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.game.bot.event.AddBotRequested;
import com.lemondelila.client.game.bot.event.BotAdded;
import com.lemondelila.client.game.bot.event.BotOperationFailed;
import com.lemondelila.client.game.bot.event.BotRemoved;
import com.lemondelila.client.game.bot.event.RemoveBotRequested;
import com.lemondelila.client.game.bot.service.BotApiService;
import com.lemondelila.client.game.room.event.RoomOperationFailed;
import com.lemondelila.client.game.room.event.RoomUpdated;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.RoomState;
import com.lemondelila.client.game.room.service.RoomApiService;

import java.io.IOException;

public final class BotController implements AutoCloseable {

    private final DomainEventBus eventBus;
    private final BotApiService botApi;
    private final BotGuard guard;
    private final TaskScheduler scheduler;
    private final RoomApiService roomApi;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public BotController(DomainEventBus eventBus,
                         BotApiService botApi,
                         BotGuard guard,
                         TaskScheduler scheduler,
                         RoomApiService roomApi) {
        this.eventBus = eventBus;
        this.botApi = botApi;
        this.guard = guard;
        this.scheduler = scheduler;
        this.roomApi = roomApi;
        subscriptions.subscribe(eventBus, AddBotRequested.class, this::onAddBot);
        subscriptions.subscribe(eventBus, RemoveBotRequested.class, this::onRemoveBot);
    }

    private void onAddBot(AddBotRequested req) {
        if (!guard.ensureAuthenticated()) {
            eventBus.publish(new BotOperationFailed("Authentification requise pour ajouter un bot"));
            return;
        }
        scheduler.runAsync(() -> {
            try {
                BotState bot = botApi.addBot(req.roomId(), req.name());
                eventBus.publish(new BotAdded(req.roomId(), bot));
                refreshRoom(req.roomId());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (IOException e) {
                eventBus.publish(new BotOperationFailed("Ajout bot impossible : " + clean(e.getMessage())));
            } catch (Exception e) {
                eventBus.publish(new BotOperationFailed("Erreur ajout bot : " + clean(e.getMessage())));
            }
        });
    }

    private void onRemoveBot(RemoveBotRequested req) {
        if (!guard.ensureAuthenticated()) {
            eventBus.publish(new BotOperationFailed("Authentification requise pour retirer un bot"));
            return;
        }
        scheduler.runAsync(() -> {
            try {
                botApi.removeBot(req.roomId(), req.botId());
                eventBus.publish(new BotRemoved(req.roomId(), req.botId()));
                refreshRoom(req.roomId());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (IOException e) {
                eventBus.publish(new BotOperationFailed("Suppression bot impossible : " + clean(e.getMessage())));
            } catch (Exception e) {
                eventBus.publish(new BotOperationFailed("Erreur suppression bot : " + clean(e.getMessage())));
            }
        });
    }

    private void refreshRoom(int roomId) {
        try {
            RoomState state = roomApi.fetchRoom(roomId);
            eventBus.publish(new RoomUpdated(state));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            eventBus.publish(new RoomOperationFailed("Impossible d'actualiser la table : " + clean(e.getMessage())));
        }
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
