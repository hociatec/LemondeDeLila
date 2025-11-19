package com.lemondelila.client.game.controller;

import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.framework.access.shortcut.ShortcutBinder;
import com.lemondelila.client.framework.ui.dialog.DialogService;

import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.event.ActionEvent;
import java.util.Optional;
import java.util.function.Consumer;
import java.util.function.Supplier;

import static javax.swing.JComponent.WHEN_IN_FOCUSED_WINDOW;

public final class GameQuitController {

    private final DialogService dialogService;
    private final Supplier<Optional<GameSummary>> currentGameSupplier;
    private final Runnable onQuitConfirmed;
    private final Consumer<String> statusConsumer;
    private final ShortcutBinder shortcutBinder;

    public GameQuitController(JComponent component,
                       DialogService dialogService,
                       Supplier<Optional<GameSummary>> currentGameSupplier,
                       Runnable onQuitConfirmed,
                       Consumer<String> statusConsumer,
                       ShortcutBinder shortcutBinder) {
        this.dialogService = dialogService;
        this.currentGameSupplier = currentGameSupplier;
        this.onQuitConfirmed = onQuitConfirmed;
        this.statusConsumer = statusConsumer;
        this.shortcutBinder = shortcutBinder;
        installBindings(component);
    }

    private void installBindings(JComponent component) {
        if (shortcutBinder != null) {
            shortcutBinder.registerLetter('q',
                    "game.quit",
                    "Lettre Q : quitter la partie.",
                    e -> handleQuit());
            return;
        }
        component.getInputMap(WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("Q"), "game.quit");
        component.getActionMap().put("game.quit", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                handleQuit();
            }
        });
    }

    private void handleQuit() {
        currentGameSupplier.get().ifPresent(game -> dialogService.confirmGameExit(
                        game.name(),
                        "Toute progression non sauvegardee sera perdue.")
                .thenAccept(confirmed -> {
                    if (Boolean.TRUE.equals(confirmed)) {
                        statusConsumer.accept("Jeu quitte.");
                        SwingUtilities.invokeLater(onQuitConfirmed);
                    } else {
                        statusConsumer.accept("Jeu conserve.");
                    }
                }));
    }
}
