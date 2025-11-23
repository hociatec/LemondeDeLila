package com.lemondelila.client.game.room.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.bot.event.BotAdded;
import com.lemondelila.client.game.bot.event.BotRemoved;
import com.lemondelila.client.game.history.service.GameActionEmitter;
import com.lemondelila.client.game.core.service.SseLogger;
import com.lemondelila.client.game.room.event.RoomPrivacyChanged;

/**
 * Service d'annonce pour les événements room (bots, privacy) vers l'historique/narration.
 */
public final class RoomHistoryAnnouncer implements AutoCloseable {

    private final GameActionEmitter emitter;
    private final EventSubscriptions subscriptions = new EventSubscriptions();
    private final SseLogger tracer;

    @Inject
    public RoomHistoryAnnouncer(DomainEventBus eventBus, GameActionEmitter emitter, SseLogger tracer) {
        this.emitter = emitter;
        this.tracer = tracer;
        subscriptions.subscribe(eventBus, BotAdded.class, e -> {
            if (e.bot() == null) return;
            String name = e.bot().name() == null || e.bot().name().isBlank() ? "Bot" : e.bot().name();
            tracer.trace("history", "BotAdded event received: " + name);
            emitter.announceAction("Bot " + name + " a rejoint la table.");
        });
        subscriptions.subscribe(eventBus, BotRemoved.class, e -> {
            String name = e.name() == null || e.name().isBlank() ? "Bot" : e.name();
            tracer.trace("history", "BotRemoved event received: " + name);
            emitter.announceAction(name + " a quitte la table.");
        });
        subscriptions.subscribe(eventBus, RoomPrivacyChanged.class, e -> {
            String status = e.isPrivate() ? "privée" : "publique";
            tracer.trace("history", "RoomPrivacyChanged event received: " + status);
            emitter.announceAction("La table est maintenant " + status + ".");
        });
    }

    @Override
    public void close() {
        subscriptions.close();
    }
}
