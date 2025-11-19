package com.lemondelila.client.game.controller;

import com.lemondelila.client.framework.access.shortcut.ShortcutBinder;

import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.event.ActionEvent;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Supplier;

import static javax.swing.JComponent.WHEN_IN_FOCUSED_WINDOW;

public final class GameBotController {

    private final Consumer<String> statusConsumer;
    private final BooleanSupplier enabledSupplier;
    private final Supplier<CompletableFuture<Void>> addBotAction;
    private final Supplier<CompletableFuture<Void>> removeBotAction;
    private final ShortcutBinder shortcutBinder;
    private final AtomicBoolean botActionRunning = new AtomicBoolean(false);

    public GameBotController(JComponent component,
                      Consumer<String> statusConsumer,
                      BooleanSupplier enabledSupplier,
                      Supplier<CompletableFuture<Void>> addBotAction,
                      Supplier<CompletableFuture<Void>> removeBotAction,
                      ShortcutBinder shortcutBinder) {
        this.statusConsumer = statusConsumer;
        this.enabledSupplier = enabledSupplier;
        this.addBotAction = addBotAction;
        this.removeBotAction = removeBotAction;
        this.shortcutBinder = shortcutBinder;
        installBindings(component);
    }

    public void resetAction() {
        botActionRunning.set(false);
    }

    private void installBindings(JComponent component) {
        if (addBotAction != null) {
            if (shortcutBinder != null) {
                shortcutBinder.registerLetter('b',
                        "game.add-bot",
                        "Lettre B : ajouter un bot.",
                        e -> handleAddBot());
            } else {
                component.getInputMap(WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("B"), "game.add-bot");
                component.getActionMap().put("game.add-bot", new AbstractAction() {
                    @Override
                    public void actionPerformed(ActionEvent e) {
                        handleAddBot();
                    }
                });
            }
        }

        if (removeBotAction != null) {
            if (shortcutBinder != null) {
                shortcutBinder.registerStroke(KeyStroke.getKeyStroke("shift B"),
                        "game.remove-bot",
                        "Maj+B : retirer un bot.",
                        e -> handleRemoveBot());
            } else {
                component.getInputMap(WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("shift B"), "game.remove-bot");
                component.getActionMap().put("game.remove-bot", new AbstractAction() {
                    @Override
                    public void actionPerformed(ActionEvent e) {
                        handleRemoveBot();
                    }
                });
            }
        }
    }

    private void handleAddBot() {
        triggerBotAction(addBotAction,
                "Ajout d'un bot en cours...",
                "Bot ajoute.",
                "Impossible d'ajouter le bot.");
    }

    private void handleRemoveBot() {
        triggerBotAction(removeBotAction,
                "Suppression d'un bot...",
                "Bot retire.",
                "Impossible de retirer le bot.");
    }

    private void triggerBotAction(Supplier<CompletableFuture<Void>> action,
                                  String startMessage,
                                  String successMessage,
                                  String errorMessage) {
        if (action == null || !enabledSupplier.getAsBoolean()) {
            return;
        }
        if (!botActionRunning.compareAndSet(false, true)) {
            return;
        }
        statusConsumer.accept(startMessage);
        CompletableFuture<Void> future;
        try {
            future = action.get();
        } catch (Exception ex) {
            botActionRunning.set(false);
            statusConsumer.accept(errorMessage);
            return;
        }
        if (future == null) {
            botActionRunning.set(false);
            statusConsumer.accept(errorMessage);
            return;
        }
        future.whenComplete((ignored, error) ->
                SwingUtilities.invokeLater(() -> {
                    botActionRunning.set(false);
                    if (!enabledSupplier.getAsBoolean()) {
                        return;
                    }
                    if (error != null) {
                        statusConsumer.accept(errorMessage);
                    } else {
                        statusConsumer.accept(successMessage);
                    }
                }));
    }
}
