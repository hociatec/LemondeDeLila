package com.lemondelila.client.game.history.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.bot.event.BotAdded;
import com.lemondelila.client.game.bot.event.BotRemoved;
import com.lemondelila.client.game.bot.service.BotTableService;
import com.lemondelila.client.game.core.service.SseLogger;
import com.lemondelila.client.game.history.service.GameActionEmitter;
import com.lemondelila.client.game.room.event.RoomPrivacyChanged;

/**
 * Ecoute les ゼvゼnements room/bot et les relaie vers l'historique (GameActionEmitter).
 */
public final class RoomHistoryAnnouncer implements AutoCloseable {

    private final GameActionEmitter emitter;
    private final BotTableService botTableService;
    private final RoomNarrationService narration;
    private final EventSubscriptions subscriptions = new EventSubscriptions();
    private final SseLogger tracer;

    @Inject
    public RoomHistoryAnnouncer(DomainEventBus eventBus,
                                GameActionEmitter emitter,
                                BotTableService botTableService,
                                RoomNarrationService narration,
                                SseLogger tracer) {
        this.emitter = emitter;
        this.botTableService = botTableService;
        this.narration = narration;
        this.tracer = tracer;
        subscriptions.subscribe(eventBus, BotAdded.class, e -> {
            if (e.bot() == null) return;
            tracer.trace("history", "BotAdded event received: " + String.valueOf(e.bot().name()));
            emitter.announceAction(botTableService.addedMessage(e.bot()));
        });
        subscriptions.subscribe(eventBus, BotRemoved.class, e -> {
            tracer.trace("history", "BotRemoved event received: " + String.valueOf(e.name()));
            emitter.announceAction(botTableService.removedMessage(e.botId(), e.name(), null));
        });
        subscriptions.subscribe(eventBus, RoomPrivacyChanged.class, e -> {
            tracer.trace("history", "RoomPrivacyChanged event received");
            emitter.announceAction(narration.privacyMessage(e.isPrivate()));
        });
    }

    @Override
    public void close() {
        subscriptions.close();
    }
}
