package com.lemondelila.client.game.history.service;

import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.view.GameHistorySidebar;

import java.util.Objects;

/**
 * Service utilitaire pour annoncer (historique + narration) un message de jeu.
 */
public final class GameAnnouncer {

    private final GameHistoryController history;
    private final NarrationQueue narrationQueue;

    @Inject
    public GameAnnouncer(GameHistoryController history, NarrationQueue narrationQueue) {
        this.history = Objects.requireNonNull(history, "history");
        this.narrationQueue = Objects.requireNonNull(narrationQueue, "narrationQueue");
    }

    public void announce(GameHistorySidebar sidebar, String message) {
        announceInternal(sidebar, message, false);
    }

    public void announceForce(GameHistorySidebar sidebar, String message) {
        announceInternal(sidebar, message, true);
    }

    public void announce(String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        history.addEntry(message);
    }

    private void announceInternal(GameHistorySidebar sidebar, String message, boolean forceRepeat) {
        if (message == null || message.isBlank()) {
            return;
        }
        history.addEntry(message);
        if (sidebar != null) {
            sidebar.render(history.tracker(), "Pas encore d'evenement.");
            if (forceRepeat) {
                narrationQueue.enqueueForce(sidebar.historyComponent(), message);
            } else {
                narrationQueue.enqueue(sidebar.historyComponent(), message);
            }
        }
    }
}
