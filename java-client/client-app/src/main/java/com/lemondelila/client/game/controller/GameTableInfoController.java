package com.lemondelila.client.game.controller;

import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import java.awt.event.ActionEvent;
import java.util.Objects;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

import static javax.swing.JComponent.WHEN_IN_FOCUSED_WINDOW;

final class GameTableInfoController {

    private final Consumer<String> statusConsumer;
    private final BooleanSupplier enabledSupplier;
    private final Runnable showTableAction;
    private final Runnable showTurnAction;

    GameTableInfoController(JComponent component,
                            Consumer<String> statusConsumer,
                            BooleanSupplier enabledSupplier,
                            Runnable showTableAction,
                            Runnable showTurnAction) {
        this.statusConsumer = Objects.requireNonNull(statusConsumer, "statusConsumer");
        this.enabledSupplier = Objects.requireNonNull(enabledSupplier, "enabledSupplier");
        this.showTableAction = showTableAction;
        this.showTurnAction = showTurnAction;
        installBindings(component);
    }

    private void installBindings(JComponent component) {
        if (showTableAction != null) {
            registerLetterAction(component, 'w', "game.show-table", showTableAction,
                    "Impossible d'afficher les joueurs autour de la table.");
        }
        if (showTurnAction != null) {
            registerLetterAction(component, 't', "game.show-turn", showTurnAction,
                    "Impossible d'annoncer le tour en cours.");
        }
    }

    private void registerLetterAction(JComponent component,
                                      char letter,
                                      String actionId,
                                      Runnable action,
                                      String errorMessage) {
        char lower = Character.toLowerCase(letter);
        char upper = Character.toUpperCase(letter);
        registerStroke(component, KeyStroke.getKeyStroke(lower), actionId, action, errorMessage);
        if (upper != lower) {
            registerStroke(component, KeyStroke.getKeyStroke(upper), actionId, action, errorMessage);
        }
    }

    private void registerStroke(JComponent component,
                                KeyStroke stroke,
                                String actionId,
                                Runnable action,
                                String errorMessage) {
        if (stroke == null) {
            return;
        }
        component.getInputMap(WHEN_IN_FOCUSED_WINDOW).put(stroke, actionId);
        component.getActionMap().put(actionId, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                handleAction(action, errorMessage);
            }
        });
    }

    private void handleAction(Runnable action, String errorMessage) {
        if (action == null || !enabledSupplier.getAsBoolean()) {
            return;
        }
        try {
            action.run();
        } catch (Exception ex) {
            if (errorMessage != null && !errorMessage.isBlank()) {
                statusConsumer.accept(errorMessage);
            }
        }
    }
}
