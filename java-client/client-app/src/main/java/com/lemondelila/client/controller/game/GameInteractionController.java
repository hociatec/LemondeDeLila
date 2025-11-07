package com.lemondelila.client.controller.game;

import com.lemondelila.client.model.catalogue.GameSummary;
import com.lemondelila.client.service.catalogue.GameRulesService;
import com.lemondelila.framework.ui.dialog.DialogService;

import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.event.ActionEvent;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import java.util.function.Supplier;

import static javax.swing.JComponent.WHEN_IN_FOCUSED_WINDOW;

/**
 * Controleur qui gere les raccourcis clavier communs aux ecrans de jeu (quitter, afficher les regles).
 */
public final class GameInteractionController {

    private final JComponent component;
    private final DialogService dialogService;
    private final GameRulesService rulesService;
    private final Supplier<Optional<GameSummary>> currentGameSupplier;
    private final Runnable onQuitConfirmed;
    private final Consumer<String> statusConsumer;

    private final AtomicBoolean rulesLoading = new AtomicBoolean(false);
    private volatile boolean enabled;

    public GameInteractionController(JComponent component,
                                     DialogService dialogService,
                                     GameRulesService rulesService,
                                     Supplier<Optional<GameSummary>> currentGameSupplier,
                                     Runnable onQuitConfirmed,
                                     Consumer<String> statusConsumer) {
        this.component = component;
        this.dialogService = dialogService;
        this.rulesService = rulesService;
        this.currentGameSupplier = currentGameSupplier;
        this.onQuitConfirmed = onQuitConfirmed;
        this.statusConsumer = statusConsumer != null ? statusConsumer : text -> { };
        installBindings();
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
        if (!enabled) {
            rulesLoading.set(false);
        }
    }

    private void installBindings() {
        component.getInputMap(WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("Q"), "game.quit");
        component.getActionMap().put("game.quit", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                handleQuit();
            }
        });

        component.getInputMap(WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("control F1"), "game.rules");
        component.getActionMap().put("game.rules", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                handleRules();
            }
        });
    }

    private Optional<GameSummary> currentGame() {
        if (!enabled) {
            return Optional.empty();
        }
        return currentGameSupplier.get();
    }

    private void handleQuit() {
        currentGame().ifPresent(game -> dialogService.confirmGameExit(
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

    private void handleRules() {
        currentGame().ifPresent(game -> {
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
                        if (!enabled) {
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
