package com.lemondelila.client.game.controller;

import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.framework.ui.dialog.DialogService;

import javax.swing.JComponent;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Controleur qui orchestre les raccourcis clavier communs aux ecrans de jeu.
 */
public final class GameInteractionController {

    private final Supplier<Optional<GameSummary>> currentGameSupplier;
    private final Runnable onQuitConfirmed;
    private final Consumer<String> statusConsumer;
    private final GameRulesController rulesController;
    private final GameBotController botController;
    private volatile boolean enabled;

    public GameInteractionController(JComponent component,
                                     DialogService dialogService,
                                     GameRulesService rulesService,
                                     Supplier<Optional<GameSummary>> currentGameSupplier,
                                     Runnable onQuitConfirmed,
                                     Consumer<String> statusConsumer) {
        this(component, dialogService, rulesService, currentGameSupplier, onQuitConfirmed, statusConsumer, null, null);
    }

    public GameInteractionController(JComponent component,
                                     DialogService dialogService,
                                     GameRulesService rulesService,
                                     Supplier<Optional<GameSummary>> currentGameSupplier,
                                     Runnable onQuitConfirmed,
                                     Consumer<String> statusConsumer,
                                     Supplier<CompletableFuture<Void>> addBotAction,
                                     Supplier<CompletableFuture<Void>> removeBotAction) {
        this.currentGameSupplier = currentGameSupplier;
        this.onQuitConfirmed = onQuitConfirmed;
        this.statusConsumer = statusConsumer != null ? statusConsumer : text -> { };

        BooleanSupplier enabledSupplier = () -> enabled;
        Supplier<Optional<GameSummary>> guardedGameSupplier = this::currentGame;

        new GameQuitController(component, dialogService, guardedGameSupplier, onQuitConfirmed, this.statusConsumer);
        this.rulesController = new GameRulesController(component, dialogService, rulesService,
                guardedGameSupplier, this.statusConsumer, enabledSupplier);

        if (addBotAction != null || removeBotAction != null) {
            this.botController = new GameBotController(component, this.statusConsumer, enabledSupplier,
                    addBotAction, removeBotAction);
        } else {
            this.botController = null;
        }
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
        if (!enabled) {
            rulesController.clearLoading();
            if (botController != null) {
                botController.resetAction();
            }
        }
    }

    private Optional<GameSummary> currentGame() {
        if (!enabled) {
            return Optional.empty();
        }
        return currentGameSupplier.get();
    }
}
