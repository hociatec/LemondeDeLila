package com.lemondelila.client.presence.service;

import com.lemondelila.client.chat.model.ChatState;
import com.lemondelila.client.framework.network.realtime.AbstractRealtimeService;
import com.lemondelila.client.presence.event.PresenceErrorEvent;
import com.lemondelila.client.presence.event.PresenceEvent;
import com.lemondelila.client.presence.event.PresenceEventListener;
import com.lemondelila.client.presence.event.PresenceStateChangedEvent;
import com.lemondelila.client.presence.event.PresenceUpdateEvent;
import com.lemondelila.client.presence.model.PresenceActivity;
import com.lemondelila.client.presence.model.PresencePlayer;
import com.lemondelila.client.presence.transport.PresenceConnection;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Service responsable de la connexion temps réel de présence.
 */
public final class PresenceRealtimeService extends AbstractRealtimeService<String, PresenceConnection> {

    private static final String PRESENCE_KEY = "presence";

    private final PresenceConnectionFactory connectionFactory;
    private final CopyOnWriteArrayList<PresenceEventListener> listeners = new CopyOnWriteArrayList<>();
    private final Object lifecycleLock = new Object();
    private AutoCloseable lease;
    private int localActiveClients;

    private volatile List<PresencePlayer> lastPresence = List.of();
    private final AtomicReference<PresenceContextState> desiredContext =
            new AtomicReference<>(PresenceContextState.home());

    public PresenceRealtimeService(PresenceConnectionFactory connectionFactory) {
        super("ws-presence");
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
    }

    public synchronized void start() {
        synchronized (lifecycleLock) {
            localActiveClients++;
            if (localActiveClients == 1) {
                lease = acquire(PRESENCE_KEY);
            }
        }
    }

    public synchronized void stop() {
        synchronized (lifecycleLock) {
            if (localActiveClients == 0) {
                return;
            }
            localActiveClients--;
            if (localActiveClients == 0 && lease != null) {
                try {
                    lease.close();
                } catch (Exception ignored) {
                }
                lease = null;
            }
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

    public void updateContext(PresenceActivity activity, Integer roomId, String roomName) {
        PresenceActivity effective = activity == null ? PresenceActivity.HOME : activity;
        PresenceContextState state = new PresenceContextState(effective, roomId, roomName);
        desiredContext.set(state);
        boolean started;
        synchronized (lifecycleLock) {
            started = localActiveClients > 0;
        }
        if (!started) {
            return;
        }
        enqueueOrRun(conn -> conn.updateContext(state.activity, state.roomId, state.roomName)
                .exceptionally(throwable -> null));
    }

    private void emit(PresenceEvent event) {
        listeners.forEach(listener -> listener.onEvent(event));
    }

    @Override
    protected PresenceConnection openConnection(String ignored, ConnectionCallbacks callbacks) {
        PresenceConnection conn = connectionFactory.open();
        conn.onPresence(players -> {
            lastPresence = players;
            emit(new PresenceUpdateEvent(players));
        });
        conn.onState(state -> {
            emit(new PresenceStateChangedEvent(state));
            if (state == ChatState.CONNECTED) {
                callbacks.onConnected();
                PresenceContextState desired = desiredContext.get();
                conn.updateContext(desired.activity, desired.roomId, desired.roomName)
                        .exceptionally(throwable -> null);
                return;
            }
            if (state == ChatState.CLOSED || state == ChatState.FAILED) {
                callbacks.onDisconnected(true);
            }
        });
        conn.onError(error -> {
            emit(new PresenceErrorEvent(error));
            callbacks.onError(new RuntimeException(error));
        });
        lastPresence = conn.latestPresence();
        conn.connect();
        return conn;
    }

    private record PresenceContextState(PresenceActivity activity, Integer roomId, String roomName) {
        private static PresenceContextState home() {
            return new PresenceContextState(PresenceActivity.HOME, null, null);
        }
    }
}
