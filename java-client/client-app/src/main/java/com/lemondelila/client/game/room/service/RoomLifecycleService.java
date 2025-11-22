package com.lemondelila.client.game.room.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.bot.event.BotAdded;
import com.lemondelila.client.game.bot.event.BotRemoved;
import com.lemondelila.client.game.bot.event.BotOperationFailed;
import com.lemondelila.client.game.room.event.RoomOperationFailed;
import com.lemondelila.client.game.room.event.RoomUpdated;
import com.lemondelila.client.game.room.model.TableState;

/**
 * Synchronise les �v�nements room/bot avec le TableState.
 */
public final class RoomLifecycleService implements AutoCloseable {

    private final TableState tableState;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public RoomLifecycleService(TableState tableState, DomainEventBus eventBus) {
        this.tableState = tableState;
        subscriptions.subscribe(eventBus, RoomUpdated.class, e -> {
            if (e.room().id() == null) {
                return;
            }
            // Toujours aligné sur l'état back.
            tableState.setRoom(e.room().id(), e.room().gameType());
            tableState.updateBots(e.room().bots());
            tableState.updatePlayers(e.room().players());
            tableState.updateStatus(e.room().status());
        });
        // On s'aligne uniquement sur RoomUpdated (pas de cache local).
        subscriptions.subscribe(eventBus, BotAdded.class, e -> { });
        subscriptions.subscribe(eventBus, BotRemoved.class, e -> { });
        subscriptions.subscribe(eventBus, BotOperationFailed.class, e -> {
            // no-op, but could expose a state flag if needed
        });
        subscriptions.subscribe(eventBus, RoomOperationFailed.class, e -> {
            // idem, placeholder for global error handling
        });
    }

    @Override
    public void close() {
        subscriptions.close();
    }
}
