package com.lemondelila.client.presence.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.presence.model.PresenceActivity;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Objects;

/**
 * Permet aux différentes vues de déclarer l'activité courante (accueil, tchat, table)
 * pour refléter fidèlement l'état de l'utilisateur dans la présence.
 */
public final class PresenceActivityReporter {

    private final PresenceRealtimeService realtimeService;
    private final Deque<State> stack = new ArrayDeque<>();
    private State current = State.home();

    @Inject
    public PresenceActivityReporter(PresenceRealtimeService realtimeService) {
        this.realtimeService = Objects.requireNonNull(realtimeService, "realtimeService");
        stack.push(current);
        realtimeService.updateContext(current.activity, current.roomId, current.roomName);
    }

    public AutoCloseable enterHome() {
        return push(State.home());
    }

    public AutoCloseable enterChat() {
        return push(State.chat());
    }

    public AutoCloseable enterTable(Integer roomId, String roomName) {
        if (roomId == null) {
            return push(State.home());
        }
        return push(State.table(roomId, roomName));
    }

    public synchronized void resetToHome() {
        stack.clear();
        current = State.home();
        stack.push(current);
        realtimeService.updateContext(current.activity, current.roomId, current.roomName);
    }

    private AutoCloseable push(State state) {
        synchronized (this) {
            stack.push(state);
            apply(state);
        }
        return new Handle(this, state);
    }

    private void remove(State handleState) {
        synchronized (this) {
            if (!stack.removeFirstOccurrence(handleState)) {
                return;
            }
            State next = stack.peek();
            if (next == null) {
                next = State.home();
                stack.push(next);
            }
            apply(next);
        }
    }

    private void apply(State state) {
        if (Objects.equals(current, state)) {
            return;
        }
        current = state;
        realtimeService.updateContext(state.activity, state.roomId, state.roomName);
    }

    private record State(PresenceActivity activity, Integer roomId, String roomName) {
        private static State home() {
            return new State(PresenceActivity.HOME, null, null);
        }

        private static State chat() {
            return new State(PresenceActivity.CHAT, null, null);
        }

        private static State table(Integer roomId, String roomName) {
            return new State(PresenceActivity.TABLE, roomId, roomName);
        }
    }

    private static final class Handle implements AutoCloseable {
        private final PresenceActivityReporter reporter;
        private final State state;
        private boolean closed;

        private Handle(PresenceActivityReporter reporter, State state) {
            this.reporter = reporter;
            this.state = state;
        }

        @Override
        public void close() {
            synchronized (this) {
                if (closed) {
                    return;
                }
                closed = true;
            }
            reporter.remove(state);
        }
    }
}
