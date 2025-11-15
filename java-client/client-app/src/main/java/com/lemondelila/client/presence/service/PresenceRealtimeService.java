package com.lemondelila.client.presence.service;

import com.lemondelila.client.chat.model.ChatState;
import com.lemondelila.client.presence.event.PresenceErrorEvent;
import com.lemondelila.client.presence.event.PresenceEvent;
import com.lemondelila.client.presence.event.PresenceEventListener;
import com.lemondelila.client.presence.event.PresenceStateChangedEvent;
import com.lemondelila.client.presence.event.PresenceUpdateEvent;
import com.lemondelila.client.presence.model.PresencePlayer;
import com.lemondelila.client.presence.transport.PresenceConnection;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Service responsable de la connexion temps réel de présence.
 */
public final class PresenceRealtimeService {

    private final PresenceConnectionFactory connectionFactory;
    private final CopyOnWriteArrayList<PresenceEventListener> listeners = new CopyOnWriteArrayList<>();
    private volatile PresenceConnection connection;
    private volatile List<PresencePlayer> lastPresence = List.of();

    public PresenceRealtimeService(PresenceConnectionFactory connectionFactory) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
    }

    public synchronized void start() {
        if (connection != null) {
            return;
        }
        PresenceConnection conn = connectionFactory.open();
        connection = conn;
        conn.onPresence(players -> {
            lastPresence = players;
            emit(new PresenceUpdateEvent(players));
        });
        conn.onState(state -> emit(new PresenceStateChangedEvent(state)));
        conn.onError(error -> emit(new PresenceErrorEvent(error)));
        lastPresence = conn.latestPresence();
        conn.connect();
    }

    public synchronized void stop() {
        if (connection != null) {
            connection.close();
            connection = null;
        }
    }

    public List<PresencePlayer> latestPresence() {
        return lastPresence == null ? List.of() : List.copyOf(lastPresence);
    }

    public void addListener(PresenceEventListener listener) {
        listeners.add(listener);
    }

    public void removeListener(PresenceEventListener listener) {
        listeners.remove(listener);
    }

    private void emit(PresenceEvent event) {
        listeners.forEach(listener -> listener.onEvent(event));
    }
}
