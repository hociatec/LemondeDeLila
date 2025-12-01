package com.lemondelila.client.game.history.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.game.history.model.GameHistoryTracker;
import com.lemondelila.client.game.room.event.LeaveRoomRequested;

public final class GameHistoryController implements AutoCloseable {

    private final GameHistoryTracker tracker;
    private final EventSubscriptions subscriptions = new EventSubscriptions();

    @Inject
    public GameHistoryController(GameHistoryTracker tracker,
                                 DomainEventBus eventBus) {
        this.tracker = tracker;
        subscriptions.subscribe(eventBus, LeaveRoomRequested.class, ev -> clear());
    }

    public GameHistoryTracker tracker() {
        return tracker;
    }

    public void addEntry(String entry) {
        tracker.add(entry);
    }

    public void clear() {
        tracker.clear();
    }

    @Override
    public void close() {
        subscriptions.close();
    }
}
