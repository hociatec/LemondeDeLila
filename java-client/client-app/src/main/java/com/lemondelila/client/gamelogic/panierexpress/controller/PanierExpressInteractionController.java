package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState;
import com.lemondelila.client.gamelogic.panierexpress.service.ActionRequest;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressApiService;

import java.io.IOException;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

public final class PanierExpressInteractionController {

    public interface Listener {
        void onState(PanierExpressState state);

        void onError(String message);
    }

    private final PanierExpressApiService api;
    private final TaskScheduler scheduler;
    private final AtomicBoolean detached = new AtomicBoolean(false);
    private volatile Integer roomId;
    private volatile Listener listener;

    public PanierExpressInteractionController(PanierExpressApiService api, TaskScheduler scheduler) {
        this.api = Objects.requireNonNull(api, "api");
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
        if (id == null || detached.get()) {
            return;
        }
        scheduler.runAsync(() -> {
            try {
                PanierExpressState state = api.fetchState(id);
                notifyState(state);
            } catch (IOException e) {
                notifyError("Lecture etat Panier Express impossible : " + clean(e.getMessage()));
            } catch (Exception e) {
                notifyError("Erreur Panier Express : " + clean(e.getMessage()));
            }
        });
    }

    public void rollDice() {
        sendActions(Collections.singletonList(ActionRequest.rollDice()));
    }

    public void answerQuiz(int choiceIndex) {
        sendActions(Collections.singletonList(ActionRequest.answerQuiz(choiceIndex)));
    }

    private void sendActions(List<ActionRequest> actions) {
        Integer id = roomId;
        if (id == null || detached.get()) {
            return;
        }
        scheduler.runAsync(() -> {
            try {
                PanierExpressState state = api.sendActions(id, actions);
                notifyState(state);
            } catch (IOException e) {
                notifyError("Action Panier Express impossible : " + clean(e.getMessage()));
            } catch (Exception e) {
                notifyError("Erreur Panier Express : " + clean(e.getMessage()));
            }
        });
    }

    private void notifyState(PanierExpressState state) {
        if (detached.get()) {
            return;
        }
        Optional.ofNullable(listener).ifPresent(l -> l.onState(state));
    }

    private void notifyError(String message) {
        if (detached.get()) {
            return;
        }
        Optional.ofNullable(listener).ifPresent(l -> l.onError(message));
    }

    private static String clean(String message) {
        if (message == null) return "erreur";
        return message.replaceAll("\\s+", " ").trim();
    }
}
