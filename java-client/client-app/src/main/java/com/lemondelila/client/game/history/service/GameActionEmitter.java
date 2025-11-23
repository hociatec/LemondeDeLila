package com.lemondelila.client.game.history.service;

import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.view.GameHistorySidebar;

/**
 * Helper pour annoncer des actions/événements de jeu de façon unifiée
 * (historique + vocalisation via GameAnnouncer).
 */
public final class GameActionEmitter {

    private final GameAnnouncer announcer;
    private final GameHistorySidebar sidebar;
    private final GameHistoryController history;

    public GameActionEmitter(GameAnnouncer announcer, GameHistorySidebar sidebar, GameHistoryController history) {
        this.announcer = announcer;
        this.sidebar = sidebar;
        this.history = history;
    }

    public void announceAction(String message) {
        if (message == null || message.isBlank()) return;
        if (history != null) {
            history.addEntry(message);
        }
        announcer.announce(sidebar, message);
    }

    public void announceEvent(String message) {
        if (message == null || message.isBlank()) return;
        if (history != null) {
            history.addEntry(message);
        }
        announcer.announce(sidebar, message);
    }

    public void announceError(String message) {
        if (message == null || message.isBlank()) return;
        if (history != null) {
            history.addEntry(message);
        }
        announcer.announce(sidebar, message);
    }
}
