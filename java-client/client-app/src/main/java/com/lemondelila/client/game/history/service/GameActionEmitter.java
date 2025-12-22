package com.lemondelila.client.game.history.service;

import com.lemondelila.client.game.history.view.GameHistorySidebar;

/**
 * Helper pour annoncer des actions/événements de jeu de façon unifiée
 * (historique + vocalisation via GameAnnouncer).
 */
public final class GameActionEmitter {

    private final GameAnnouncer announcer;
    private final GameHistorySidebar sidebar;

    public GameActionEmitter(GameAnnouncer announcer, GameHistorySidebar sidebar) {
        this.announcer = announcer;
        this.sidebar = sidebar;
    }

    public void announceAction(String message) {
        announcer.announce(sidebar, message);
    }

    public void announceEvent(String message) {
        announcer.announce(sidebar, message);
    }

    public void announceEventForce(String message) {
        announcer.announceForce(sidebar, message);
    }

    public void announceError(String message) {
        announcer.announce(sidebar, message);
    }
}
