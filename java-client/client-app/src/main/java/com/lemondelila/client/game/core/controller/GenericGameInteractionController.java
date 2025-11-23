package com.lemondelila.client.game.core.controller;

import com.lemondelila.client.game.core.model.ActionRequest;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.model.PrimaryActionDescriptor;
import com.lemondelila.client.game.core.service.GameStateService;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import java.util.function.BooleanSupplier;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

public final class GenericGameInteractionController {

    public interface Listener {
        void onState(GenericGameState state);
        void onError(String message);
    }

    private final String gameType;
    private final GameStateService states;
    private final PrimaryActionDescriptor primaryAction;
    private final TaskScheduler scheduler;
    private final AtomicBoolean detached = new AtomicBoolean(false);
    private volatile Integer roomId;
    private volatile Listener listener;
    private volatile BooleanSupplier participantGate;

    public GenericGameInteractionController(String gameType,
                                            GameStateService states,
                                            PrimaryActionDescriptor primaryAction,
                                            TaskScheduler scheduler) {
        this.gameType = Objects.requireNonNull(gameType, "gameType");
        this.states = Objects.requireNonNull(states, "states");
        this.primaryAction = primaryAction;
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
    }

    public void attach(int roomId, Listener listener) {
        this.roomId = roomId;
        this.listener = listener;
        this.detached.set(false);
        refresh();
    }

    public void detach() {
        detached.set(true);
        listener = null;
        roomId = null;
    }

    public void refresh() {
        Integer id = roomId;
        if (id == null || detached.get()) return;
        if (participantGate != null && !participantGate.getAsBoolean()) {
            return;
        }
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

    public void triggerPrimaryAction() {
        if (primaryAction == null) {
            return;
        }
        if (participantGate != null && !participantGate.getAsBoolean()) {
            notifyError("Impossible de démarrer : ajoutez au moins un autre joueur ou un bot.");
            return;
        }
        sendActions(Collections.singletonList(primaryAction.action()));
    }

    public void sendActions(List<ActionRequest> actions) {
        Integer id = roomId;
        if (id == null || detached.get()) return;
        if (participantGate != null && !participantGate.getAsBoolean()) {
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
        Optional.ofNullable(listener).ifPresent(l -> l.onState(state));
    }

    public void setParticipantGate(BooleanSupplier gate) {
        this.participantGate = gate;
    }

    private void notifyError(String message) {
        if (detached.get()) return;
        Optional.ofNullable(listener).ifPresent(l -> l.onError(message));
    }

    private static String clean(String message) {
        if (message == null) return "erreur";
        return message.replaceAll("\\s+", " ").trim();
    }

    private String buildFriendlyError(Exception e) {
        String msg = clean(e.getMessage());
        if (msg.toLowerCase().contains("au moins deux participants")) {
            return "Impossible de démarrer : ajoutez au moins un autre joueur ou un bot.";
        }
        if (msg.contains("400")) {
            return "Action impossible : vérifiez les participants ou l'état de la table.";
        }
        return msg;
    }
}
