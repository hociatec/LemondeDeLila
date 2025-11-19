package com.lemondelila.client.game.presentation;

import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.access.shortcut.ShortcutBinder;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.game.controller.GameActionState;
import com.lemondelila.client.game.controller.GameBotController;
import com.lemondelila.client.game.controller.GameQuitController;
import com.lemondelila.client.game.controller.GameRulesController;
import com.lemondelila.client.game.controller.GameTableInfoController;
import com.lemondelila.client.game.service.GameCommandActions;
import com.lemondelila.client.game.service.GameCommandCenter;

import javax.swing.JComponent;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Centralise l'initialisation des contrôleurs communs à tous les écrans de jeux :
 * raccourcis, dialogues de sortie, affichage des règles, bots, etc.
 */
public final class GameScreenSupport {

    private final GameActionState actionState;
    private final ShortcutBinder shortcutBinder;
    private final GameQuitController quitController;
    private final GameRulesController rulesController;
    private final GameBotController botController;
    private final GameTableInfoController tableInfoController;

    private GameScreenSupport(GameActionState actionState,
                              ShortcutBinder shortcutBinder,
                              GameQuitController quitController,
                              GameRulesController rulesController,
                              GameBotController botController,
                              GameTableInfoController tableInfoController) {
        this.actionState = actionState;
        this.shortcutBinder = shortcutBinder;
        this.quitController = quitController;
        this.rulesController = rulesController;
        this.botController = botController;
        this.tableInfoController = tableInfoController;
    }

    public GameActionState actionState() {
        return actionState;
    }

    public ShortcutBinder shortcutBinder() {
        return shortcutBinder;
    }

    public GameQuitController quitController() {
        return quitController;
    }

    public GameRulesController rulesController() {
        return rulesController;
    }

    public Optional<GameBotController> botController() {
        return Optional.ofNullable(botController);
    }

    public Optional<GameTableInfoController> tableInfoController() {
        return Optional.ofNullable(tableInfoController);
    }

    public static Builder builder(JComponent rootComponent,
                                  GameSummary summary,
                                  DialogService dialogService,
                                  GameRulesService rulesService,
                                  AccessibleShortcutRegistry shortcutRegistry,
                                  GameCommandCenter commandCenter) {
        return new Builder(rootComponent, summary, dialogService, rulesService, shortcutRegistry, commandCenter);
    }

    public static final class Builder {

        private final JComponent rootComponent;
        private final GameSummary summary;
        private final DialogService dialogService;
        private final GameRulesService rulesService;
        private final AccessibleShortcutRegistry shortcutRegistry;
        private final GameCommandCenter commandCenter;
        private final List<JComponent> extraTargets = new ArrayList<>();

        private GameActionState actionState;
        private Consumer<String> statusConsumer = message -> {};
        private Runnable quitAction = () -> {};
        private Supplier<CompletableFuture<Void>> addBotAction;
        private Supplier<CompletableFuture<Void>> removeBotAction;
        private Runnable announcePlayersAction;
        private Runnable announceTurnAction;
        private GameCommandActions commandActions;
        private BooleanSupplier guard;

        private Builder(JComponent rootComponent,
                        GameSummary summary,
                        DialogService dialogService,
                        GameRulesService rulesService,
                        AccessibleShortcutRegistry shortcutRegistry,
                        GameCommandCenter commandCenter) {
            this.rootComponent = Objects.requireNonNull(rootComponent, "rootComponent");
            this.summary = Objects.requireNonNull(summary, "summary");
            this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
            this.rulesService = Objects.requireNonNull(rulesService, "rulesService");
            this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
            this.commandCenter = Objects.requireNonNull(commandCenter, "commandCenter");
        }

        public Builder withActionState(GameActionState actionState) {
            this.actionState = actionState;
            return this;
        }

        public Builder withStatusConsumer(Consumer<String> statusConsumer) {
            this.statusConsumer = statusConsumer != null ? statusConsumer : message -> {};
            return this;
        }

        public Builder withQuitAction(Runnable quitAction) {
            this.quitAction = quitAction != null ? quitAction : () -> {};
            return this;
        }

        public Builder withBotActions(Supplier<CompletableFuture<Void>> addAction,
                                      Supplier<CompletableFuture<Void>> removeAction) {
            this.addBotAction = addAction;
            this.removeBotAction = removeAction;
            return this;
        }

        public Builder withTableInfoActions(Runnable announcePlayers, Runnable announceTurn) {
            this.announcePlayersAction = announcePlayers;
            this.announceTurnAction = announceTurn;
            return this;
        }

        public Builder withCommandActions(GameCommandActions commandActions) {
            this.commandActions = commandActions;
            return this;
        }

        public Builder withShortcutTargets(JComponent... targets) {
            if (targets != null) {
                for (JComponent target : targets) {
                    if (target != null) {
                        extraTargets.add(target);
                    }
                }
            }
            return this;
        }

        public Builder withGuard(BooleanSupplier guard) {
            this.guard = guard;
            return this;
        }

        public GameScreenSupport build() {
            GameActionState resolvedActionState = actionState != null ? actionState : new GameActionState();
            BooleanSupplier resolvedGuard = guard != null ? guard : resolvedActionState::isEnabled;

            List<JComponent> shortcutTargets = new ArrayList<>();
            shortcutTargets.add(rootComponent);
            shortcutTargets.addAll(extraTargets);
            ShortcutBinder binder = new ShortcutBinder(
                    shortcutRegistry,
                    resolvedGuard,
                    shortcutTargets.toArray(JComponent[]::new)
            );

            if (commandActions != null) {
                commandCenter.registerCommonCommands(binder, commandActions);
            }

            Supplier<Optional<GameSummary>> summarySupplier = () -> Optional.of(summary);

            GameQuitController quitController = new GameQuitController(
                    rootComponent,
                    dialogService,
                    summarySupplier,
                    quitAction,
                    statusConsumer,
                    binder
            );

            GameRulesController rulesController = new GameRulesController(
                    rootComponent,
                    dialogService,
                    rulesService,
                    summarySupplier,
                    statusConsumer,
                    resolvedGuard,
                    binder
            );

            resolvedActionState.onDisabled(rulesController::clearLoading);

            GameBotController botController = null;
            if (addBotAction != null || removeBotAction != null) {
                botController = new GameBotController(
                        rootComponent,
                        statusConsumer,
                        resolvedGuard,
                        addBotAction,
                        removeBotAction,
                        binder
                );
                resolvedActionState.onDisabled(botController::resetAction);
            }

            GameTableInfoController tableInfoController = null;
            if (announcePlayersAction != null || announceTurnAction != null) {
                tableInfoController = new GameTableInfoController(
                        rootComponent,
                        statusConsumer,
                        resolvedGuard,
                        announcePlayersAction,
                        announceTurnAction,
                        binder
                );
            }

            return new GameScreenSupport(
                    resolvedActionState,
                    binder,
                    quitController,
                    rulesController,
                    botController,
                    tableInfoController
            );
        }
    }
}
