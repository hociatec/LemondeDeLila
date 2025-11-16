package com.lemondelila.client.gamelogic.panierexpress.presenter;

import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressController;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Encapsule les actions utilisateur (roll, refresh, quiz…) pour Panier Express afin de
 * tenir le busy-state et la narration hors de la vue principale.
 */
public final class PanierExpressGameInteractor {

    private final PanierExpressController controller;
    private final PanierExpressPresenter presenter;
    private final Consumer<String> narrator;
    private volatile boolean busy;

    public PanierExpressGameInteractor(PanierExpressController controller,
                                       PanierExpressPresenter presenter,
                                       Consumer<String> narrator) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.presenter = Objects.requireNonNull(presenter, "presenter");
        this.narrator = Objects.requireNonNull(narrator, "narrator");
    }

    public boolean isBusy() {
        return busy;
    }

    public void startGame(PanierExpressGameOptions options, String pendingMessage) {
        if (denyIfBusy()) {
            return;
        }
        execute(() -> controller.startGame(true, options), pendingMessage);
    }

    public void attemptRoll() {
        if (denyIfBusy()) {
            return;
        }
        if (!presenter.hasActiveSession()) {
            narrator.accept("Aucune partie active.");
            return;
        }
        if (presenter.isFinished()) {
            narrator.accept("La partie est terminée.");
            return;
        }
        if (presenter.hasPendingActionForYou()) {
            narrator.accept("Répondez d’abord au quiz.");
            return;
        }
        if (!presenter.isYourTurn()) {
            narrator.accept("Ce n’est pas votre tour.");
            return;
        }
        execute(controller::roll, "Lancer du dé...");
    }

    public void attemptRefresh() {
        if (denyIfBusy()) {
            return;
        }
        if (!presenter.hasActiveSession()) {
            narrator.accept("Aucune partie active.");
            return;
        }
        execute(controller::refreshGame, "Actualisation de la partie...");
    }

    public void submitQuizAnswer(int index) {
        if (denyIfBusy()) {
            return;
        }
        Optional<PanierExpressSession> sessionOpt = presenter.currentSession();
        if (sessionOpt.isEmpty()) {
            narrator.accept("Aucune partie active.");
            return;
        }
        PanierExpressState state = sessionOpt.get().state();
        PanierExpressState.PendingQuiz pending = state.pending();
        if (pending == null) {
            narrator.accept("Aucun quiz à répondre.");
            return;
        }
        if (!presenter.hasPendingActionForYou()) {
            narrator.accept("Le quiz en cours concerne un autre joueur.");
            return;
        }
        List<String> choices = pending.choices();
        if (choices == null || index < 0 || index >= choices.size()) {
            narrator.accept("Choix invalide.");
            return;
        }
        execute(() -> controller.answerQuiz(index), "Réponse " + (index + 1) + " envoyée...");
    }

    private boolean denyIfBusy() {
        if (busy) {
            narrator.accept("Action déjà en cours. Patientez.");
            return true;
        }
        return false;
    }

    private void execute(Supplier<CompletableFuture<PanierExpressSession>> action,
                         String pendingMessage) {
        CompletableFuture<PanierExpressSession> future;
        try {
            busy = true;
            if (pendingMessage != null && !pendingMessage.isBlank()) {
                narrator.accept(pendingMessage);
            }
            future = action.get();
        } catch (Exception ex) {
            busy = false;
            narrator.accept(resolveErrorMessage(ex));
            return;
        }
        if (future == null) {
            busy = false;
            narrator.accept("Action impossible.");
            return;
        }
        future.whenComplete((session, error) -> {
            busy = false;
            if (error != null) {
                narrator.accept(resolveErrorMessage(error));
            }
        });
    }

    private String resolveErrorMessage(Throwable error) {
        if (error == null) {
            return "Action impossible.";
        }
        Throwable cause = error;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }
        String message = cause.getMessage();
        if (message == null || message.isBlank()) {
            return "Action impossible.";
        }
        return "Erreur : " + message;
    }
}
