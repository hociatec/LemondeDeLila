package com.lemondelila.client.game.core.controller;

import com.lemondelila.client.game.core.model.ActionRequest;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.model.PrimaryActionDescriptor;
import com.lemondelila.client.game.core.service.GameStateService;
import com.lemondelila.client.game.room.service.RoomParticipantsMapper;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.framework.core.task.TaskScheduler;

import java.io.IOException;
import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.concurrent.ScheduledFuture;

public final class GenericGameInteractionController {

    public interface Listener {
        void onState(GenericGameState state);
        void onError(String message);
    }

    private static final String PARTICIPANT_ERROR = "Vous ne pouvez demarrer une partie avec un joueur.";

    private final String gameType;
    private final GameStateService states;
    private final PrimaryActionDescriptor primaryAction;
    private final TaskScheduler scheduler;
    private final TableState tableState;
    private final int minimumParticipants;
    private final List<Consumer<GenericGameState>> stateObservers = new CopyOnWriteArrayList<>();
    private final AtomicBoolean detached = new AtomicBoolean(false);
    private volatile Integer roomId;
    private volatile Listener listener;
    private volatile boolean startPending = false;
    private volatile ScheduledFuture<?> autoRefresh;

    public GenericGameInteractionController(String gameType,
                                            GameStateService states,
                                            PrimaryActionDescriptor primaryAction,
                                            TaskScheduler scheduler,
                                            TableState tableState,
                                            int minimumParticipants) {
        this.gameType = Objects.requireNonNull(gameType, "gameType");
        this.states = Objects.requireNonNull(states, "states");
        this.primaryAction = primaryAction;
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
        this.tableState = Objects.requireNonNull(tableState, "tableState");
        this.minimumParticipants = Math.max(1, minimumParticipants);
    }

    public void attach(int roomId, Listener listener) {
        this.roomId = roomId;
        this.listener = listener;
        this.detached.set(false);
        refresh();
        startAutoRefresh(Duration.ofSeconds(1));
    }

    public void detach() {
        detached.set(true);
        listener = null;
        roomId = null;
        stopAutoRefresh();
    }

    public void refresh() {
        Integer id = roomId;
        if (id == null || detached.get()) return;
        scheduler.runAsync(() -> {
            try {
                GenericGameState state = states.fetchState(gameType, id);
                notifyState(state);
            } catch (IOException e) {
                notifyError(buildFriendlyError(e));
            } catch (Exception e) {
                notifyError(buildFriendlyError(e));
            }
        });
    }

    public void startAutoRefresh(Duration period) {
        stopAutoRefresh();
        if (period == null || period.isNegative() || period.isZero()) {
            return;
        }
        autoRefresh = scheduler.scheduleAtFixedRate(this::refresh, period, period);
    }

    public void stopAutoRefresh() {
        ScheduledFuture<?> future = autoRefresh;
        if (future != null) {
            future.cancel(true);
            autoRefresh = null;
        }
    }

    public void triggerPrimaryAction() {
        if (primaryAction == null) {
            return;
        }
        if (!hasEnoughParticipants()) {
            notifyError(PARTICIPANT_ERROR);
            return;
        }
        sendActions(Collections.singletonList(primaryAction.action()));
    }

    public void sendActions(List<ActionRequest> actions) {
        Integer id = roomId;
        if (id == null || detached.get()) return;
        if (!hasEnoughParticipants()) {
            notifyError("Action impossible : ajoutez au moins un autre joueur ou un bot.");
            return;
        }
        scheduler.runAsync(() -> {
            try {
                GenericGameState state = states.sendActions(gameType, id, actions);
                notifyState(state);
            } catch (IOException e) {
                notifyError(buildFriendlyError(e));
            } catch (Exception e) {
                notifyError(buildFriendlyError(e));
            }
        });
    }

    private void notifyState(GenericGameState state) {
        if (detached.get()) return;
        if (state != null) {
            String status = state.status();
            if (status != null && !status.isBlank() && !"open".equalsIgnoreCase(status)) {
                clearStartPending();
            }
            tableState.updateStatus(state.status());
            if (state.extras() != null && !state.extras().isEmpty()) {
                RoomParticipantsMapper.updateFromExtras(tableState, state.extras());
            }
        }
        Optional.ofNullable(listener).ifPresent(l -> l.onState(state));
        for (Consumer<GenericGameState> observer : stateObservers) {
            try {
                observer.accept(state);
            } catch (Exception ignored) {
            }
        }
    }

    private void notifyError(String message) {
        if (detached.get() || message == null || message.isBlank()) return;
        Optional.ofNullable(listener).ifPresent(l -> l.onError(message));
    }

    private static String clean(String message) {
        if (message == null) return "erreur";
        return message.replaceAll("\\s+", " ").trim();
    }

    private String buildFriendlyError(Exception e) {
        String msg = clean(e.getMessage());
        if (msg.toLowerCase().contains("au moins deux participants")) {
            return null;
        }
        if (msg.contains("400")) {
            return "Action impossible : vérifiez les participants ou l'état de la table.";
        }
        return msg;
    }

    public boolean hasEnoughParticipants() {
        if (!detached.get() && tableState != null) {
            int participants = tableState.participantCountIncludingLocalParticipant();
            return participants >= minimumParticipants;
        }
        return true;
    }

    public String participantRequirementMessage() {
        return PARTICIPANT_ERROR;
    }

    public int minimumParticipants() {
        return minimumParticipants;
    }

    public void addStateObserver(Consumer<GenericGameState> observer) {
        if (observer == null) {
            return;
        }
        stateObservers.add(observer);
    }

    public void removeStateObserver(Consumer<GenericGameState> observer) {
        if (observer == null) {
            return;
        }
        stateObservers.remove(observer);
    }

    public void markStartPending() {
        startPending = true;
    }

    public void clearStartPending() {
        startPending = false;
    }
}
