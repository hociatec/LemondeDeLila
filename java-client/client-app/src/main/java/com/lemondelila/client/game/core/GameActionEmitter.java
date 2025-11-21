package com.lemondelila.client.game.core;

import com.lemondelila.client.game.history.view.GameHistorySidebar;

/**
 * Petit helper pour annoncer des actions/événements de jeu de façon unifiée
 * (historique + vocalisation).
 */
public final class GameActionEmitter {

    private final GameAnnouncer announcer;
    private final GameHistorySidebar sidebar;

    public GameActionEmitter(GameAnnouncer announcer, GameHistorySidebar sidebar) {
        this.announcer = announcer;
        this.sidebar = sidebar;
    }

    public void announceAction(String message) {
        if (message == null || message.isBlank()) return;
        announcer.announce(sidebar, message);
    }

    public void announceEvent(String message) {
        if (message == null || message.isBlank()) return;
        announcer.announce(sidebar, message);
    }

    public void announceError(String message) {
        if (message == null || message.isBlank()) return;
        announcer.announce(sidebar, message);
    }
}
