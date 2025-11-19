package com.lemondelila.client.game.controller;

import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.framework.access.shortcut.ShortcutBinder;
import com.lemondelila.client.framework.ui.dialog.DialogService;

import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.event.ActionEvent;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Supplier;

import static javax.swing.JComponent.WHEN_IN_FOCUSED_WINDOW;

public final class GameRulesController {

    private final DialogService dialogService;
    private final GameRulesService rulesService;
    private final Supplier<Optional<GameSummary>> currentGameSupplier;
    private final Consumer<String> statusConsumer;
    private final BooleanSupplier enabledSupplier;
    private final ShortcutBinder shortcutBinder;
    private final AtomicBoolean rulesLoading = new AtomicBoolean(false);

    public GameRulesController(JComponent component,
                        DialogService dialogService,
                        GameRulesService rulesService,
                        Supplier<Optional<GameSummary>> currentGameSupplier,
                        Consumer<String> statusConsumer,
                        BooleanSupplier enabledSupplier,
                        ShortcutBinder shortcutBinder) {
        this.dialogService = dialogService;
        this.rulesService = rulesService;
        this.currentGameSupplier = currentGameSupplier;
        this.statusConsumer = statusConsumer;
        this.enabledSupplier = enabledSupplier;
        this.shortcutBinder = shortcutBinder;
        installBindings(component);
    }

    public void clearLoading() {
        rulesLoading.set(false);
    }

    public void showRules() {
        handleRules();
    }

    private void installBindings(JComponent component) {
        if (shortcutBinder != null) {
            shortcutBinder.registerStroke("control F1",
                    "game.rules",
                    "Ctrl+F1 : afficher les règles du jeu.",
                    e -> handleRules());
            return;
        }
        component.getInputMap(WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("control F1"), "game.rules");
        component.getActionMap().put("game.rules", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                handleRules();
            }
        });
    }

    private void handleRules() {
        currentGameSupplier.get().ifPresent(game -> {
            if (!game.hasRules()) {
                dialogService.info("Regles indisponibles", "Ce jeu ne fournit pas encore de regles.");
                statusConsumer.accept("Regles non disponibles.");
                return;
            }
            if (!rulesLoading.compareAndSet(false, true)) {
                return;
            }
            statusConsumer.accept("Chargement des regles...");
            rulesService.fetchRules(game).whenComplete((rules, error) ->
                    SwingUtilities.invokeLater(() -> {
                        rulesLoading.set(false);
                        if (!enabledSupplier.getAsBoolean()) {
                            return;
                        }
                        if (error != null) {
                            dialogService.error("Regles indisponibles",
                                    "Impossible de recuperer les regles pour le moment.");
                            statusConsumer.accept("Echec du chargement des regles.");
                            return;
                        }
                        String content = rules == null || rules.isBlank()
                                ? "Aucune regle n'est disponible pour ce jeu."
                                : rules;
                        dialogService.showScrollableText("Regles - " + game.name(), content);
                        statusConsumer.accept("Regles affichees.");
                    }));
        });
    }
}
