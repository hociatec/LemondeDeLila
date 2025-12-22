package com.lemondelila.client.game.bot.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.game.bot.event.AddBotRequested;
import com.lemondelila.client.game.bot.event.BotOperationFailed;
import com.lemondelila.client.game.bot.event.RemoveBotRequested;
import com.lemondelila.client.game.bot.controller.BotGuard;
import com.lemondelila.client.game.room.service.RoomRealtimeService;

import java.util.Map;

public final class BotController implements AutoCloseable {

    private final DomainEventBus eventBus;
    private final RoomRealtimeService realtime;
    private final BotGuard guard;
    private final TaskScheduler scheduler;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public BotController(DomainEventBus eventBus,
                         RoomRealtimeService realtime,
                         BotGuard guard,
                         TaskScheduler scheduler) {
        this.eventBus = eventBus;
        this.realtime = realtime;
        this.guard = guard;
        this.scheduler = scheduler;
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
                realtime.sendCommand("bot.add", Map.of("roomId", req.roomId()));
            } catch (Exception e) {
                eventBus.publish(new BotOperationFailed("Ajout bot impossible : " + clean(e.getMessage())));
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
                realtime.sendCommand("bot.remove", Map.of(
                        "roomId", req.roomId(),
                        "botId", req.botId()
                ));
            } catch (Exception e) {
                eventBus.publish(new BotOperationFailed("Suppression bot impossible : " + clean(e.getMessage())));
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
