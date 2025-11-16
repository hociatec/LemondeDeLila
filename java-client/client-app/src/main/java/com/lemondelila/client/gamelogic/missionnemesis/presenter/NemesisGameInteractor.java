package com.lemondelila.client.gamelogic.missionnemesis.presenter;

import com.lemondelila.client.gamelogic.missionnemesis.controller.NemesisController;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;

import javax.swing.SwingUtilities;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Encapsule les actions utilisateur (rafraîchir, gérer les bots) pour l'écran Nemesis afin de
 * garder la logique réseau hors de la vue.
 */
public final class NemesisGameInteractor {

    private final NemesisController controller;
    private final Supplier<Optional<NemesisSession>> sessionSupplier;
    private final Consumer<String> statusConsumer;
    private volatile boolean refreshing;

    public NemesisGameInteractor(NemesisController controller,
                                 Supplier<Optional<NemesisSession>> sessionSupplier,
                                 Consumer<String> statusConsumer) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.sessionSupplier = Objects.requireNonNull(sessionSupplier, "sessionSupplier");
        this.statusConsumer = Objects.requireNonNull(statusConsumer, "statusConsumer");
    }

    public void refreshGame() {
        if (refreshing) {
            statusConsumer.accept("Rafraichissement déjà en cours...");
            return;
        }
        if (sessionSupplier.get().isEmpty()) {
            statusConsumer.accept("Aucune partie active.");
            return;
        }
        refreshing = true;
        statusConsumer.accept("Rafraichissement de l'etat en cours...");
        controller.refresh().whenComplete((session, error) ->
                SwingUtilities.invokeLater(() -> {
                    refreshing = false;
                    if (error != null) {
                        statusConsumer.accept("Impossible de rafraichir l'etat de la partie.");
                    } else {
                        statusConsumer.accept("Etat mis a jour.");
                    }
                })
        );
    }

    public CompletableFuture<Void> addBot() {
        statusConsumer.accept("Ajout d'un bot en cours...");
        CompletableFuture<Void> future = controller.addBot().thenApply(session -> null);
        future.whenComplete((ignored, error) ->
                SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        statusConsumer.accept("Impossible d'ajouter le bot.");
                    } else {
                        statusConsumer.accept("Bot ajouté.");
                    }
                })
        );
        return future;
    }

    public CompletableFuture<Void> removeBot() {
        statusConsumer.accept("Suppression d'un bot...");
        CompletableFuture<Void> future = controller.removeBot().thenApply(session -> null);
        future.whenComplete((ignored, error) ->
                SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        statusConsumer.accept("Impossible de retirer le bot.");
                    } else {
                        statusConsumer.accept("Bot retiré.");
                    }
                })
        );
        return future;
    }
}
