package com.lemondelila.client.gamelogic.missionnemesis.controller;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;
import com.lemondelila.client.game.model.GameSessionTracker;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;

import java.net.http.WebSocket;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

final class NemesisSessionCoordinator {

    private final GameSessionTracker<NemesisSession> sessions;
    private final RealtimeGateway realtimeGateway;
    private final Map<Consumer<NemesisSession>, AutoCloseable> listenerHandles = new ConcurrentHashMap<>();
    private volatile NemesisSession current;

    NemesisSessionCoordinator(NemesisSessionStore sessionStore,
                              DomainEventBus eventBus,
                              RealtimeGateway realtimeGateway) {
        this.sessions = new GameSessionTracker<>(sessionStore, eventBus);
        this.realtimeGateway = realtimeGateway;
        this.current = sessionStore.current().orElse(null);
        if (this.current != null) {
            this.realtimeGateway.connect();
        }
    }

    Optional<NemesisSession> currentSession() {
        return Optional.ofNullable(current);
    }

    NemesisSession snapshot() {
        return current;
    }

    void updateSession(NemesisSession session) {
        current = session;
        sessions.save(session);
        realtimeGateway.connect();
    }

    void addListener(Consumer<NemesisSession> listener) {
        AutoCloseable handle = sessions.listen(listener);
        listenerHandles.put(listener, handle);
    }

    void removeListener(Consumer<NemesisSession> listener) {
        AutoCloseable handle = listenerHandles.remove(listener);
        if (handle != null) {
            try {
                handle.close();
            } catch (Exception ignored) {
            }
        }
    }

    boolean isTrackedRoom(int roomId) {
        NemesisSession snapshot = current;
        if (snapshot != null && snapshot.roomId() == roomId) {
            return true;
        }
        return sessions.find(roomId).isPresent();
    }

    void reset() {
        current = null;
        sessions.clearAll();
        realtimeGateway.disconnect(WebSocket.NORMAL_CLOSURE, "reset");
    }
}
