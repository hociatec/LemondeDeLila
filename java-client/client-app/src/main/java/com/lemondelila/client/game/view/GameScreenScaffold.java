package com.lemondelila.client.game.view;

import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.access.shortcut.ShortcutBinder;
import com.lemondelila.client.framework.ui.component.NarrationPanel;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.game.controller.GameActionState;
import com.lemondelila.client.game.presentation.GameScreenSupport;
import com.lemondelila.client.game.service.GameCommandActions;
import com.lemondelila.client.game.service.GameCommandCenter;

import javax.swing.JComponent;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Helper that wraps {@link GameScreenSupport} and centralises dialog binding,
 * narration and shortcut scopes for game screens.
 */
public final class GameScreenScaffold implements AutoCloseable {

    private final GameScreenSupport screenSupport;
    private final DialogService dialogService;
    private final AccessibleShortcutRegistry shortcutRegistry;
    private final Supplier<NarrationQueue> narrationQueueSupplier;
    private final NarrationPanel narrationPanel;

    private final List<AutoCloseable> shortcutAttachments = new ArrayList<>();
    private AutoCloseable shortcutScope;
    private AutoCloseable dialogBinding;

    private GameScreenScaffold(GameScreenSupport screenSupport,
                               DialogService dialogService,
                               AccessibleShortcutRegistry shortcutRegistry,
                               Supplier<NarrationQueue> narrationQueueSupplier,
                               NarrationPanel narrationPanel) {
        this.screenSupport = screenSupport;
        this.dialogService = dialogService;
        this.shortcutRegistry = shortcutRegistry;
        this.narrationQueueSupplier = narrationQueueSupplier;
        this.narrationPanel = narrationPanel;
    }

    public GameActionState actionState() {
        return screenSupport.actionState();
    }

    public GameScreenSupport support() {
        return screenSupport;
    }

    public void narrate(String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        narrationPanel.announce(message);
        try {
            NarrationQueue queue = narrationQueueSupplier.get();
            if (queue != null) {
                queue.enqueue(narrationPanel.component(), message);
            }
        } catch (Exception ignored) {
        }
    }

    public ShortcutBinder binder() {
        return screenSupport.shortcutBinder();
    }

    public void bindDialog(JComponent host) {
        releaseDialog();
        dialogBinding = dialogService.attach(host);
    }

    public void releaseDialog() {
        closeQuietly(dialogBinding);
        dialogBinding = null;
    }

    public void applyShortcutScope(JComponent... targets) {
        resetShortcutScope();
        shortcutScope = shortcutRegistry.openScope();
        if (targets == null || targets.length == 0) {
            shortcutAttachments.add(shortcutRegistry.applyTo(narrationPanel.component()));
            return;
        }
        for (JComponent target : targets) {
            if (target != null) {
                shortcutAttachments.add(shortcutRegistry.applyTo(target));
            }
        }
    }

    public void resetShortcutScope() {
        closeQuietly(shortcutScope);
        shortcutScope = null;
        shortcutAttachments.forEach(GameScreenScaffold::closeQuietly);
        shortcutAttachments.clear();
    }

    @Override
    public void close() {
        resetShortcutScope();
        releaseDialog();
    }

    private static void closeQuietly(AutoCloseable closeable) {
        if (closeable == null) {
            return;
        }
        try {
            closeable.close();
        } catch (Exception ignored) {
        }
    }

    public static Builder builder(JComponent rootComponent,
                                  GameSummary summary,
                                  DialogService dialogService,
                                  GameRulesService rulesService,
                                  AccessibleShortcutRegistry shortcutRegistry,
                                  GameCommandCenter commandCenter,
                                  Supplier<NarrationQueue> narrationQueueSupplier,
                                  NarrationPanel narrationPanel) {
        return new Builder(rootComponent,
                summary,
                dialogService,
                rulesService,
                shortcutRegistry,
                commandCenter,
                narrationQueueSupplier,
                narrationPanel);
    }

    public static final class Builder {
        private final GameScreenSupport.Builder supportBuilder;
        private final DialogService dialogService;
        private final AccessibleShortcutRegistry shortcutRegistry;
        private final Supplier<NarrationQueue> narrationQueueSupplier;
        private final NarrationPanel narrationPanel;

        private final List<JComponent> extraTargets = new ArrayList<>();

        private Builder(JComponent rootComponent,
                        GameSummary summary,
                        DialogService dialogService,
                        GameRulesService rulesService,
                        AccessibleShortcutRegistry shortcutRegistry,
                        GameCommandCenter commandCenter,
                        Supplier<NarrationQueue> narrationQueueSupplier,
                        NarrationPanel narrationPanel) {
            this.supportBuilder = GameScreenSupport.builder(
                    rootComponent,
                    summary,
                    dialogService,
                    rulesService,
                    shortcutRegistry,
                    commandCenter);
            this.dialogService = dialogService;
            this.shortcutRegistry = shortcutRegistry;
            this.narrationQueueSupplier = narrationQueueSupplier;
            this.narrationPanel = narrationPanel;
        }

        public Builder withActionState(GameActionState actionState) {
            supportBuilder.withActionState(actionState);
            return this;
        }

        public Builder withStatusConsumer(Consumer<String> statusConsumer) {
            supportBuilder.withStatusConsumer(statusConsumer);
            return this;
        }

        public Builder withQuitAction(Runnable quitAction) {
            supportBuilder.withQuitAction(quitAction);
            return this;
        }

        public Builder withCommandActions(GameCommandActions actions) {
            supportBuilder.withCommandActions(actions);
            return this;
        }

        public Builder withTableInfoActions(Runnable announcePlayers, Runnable announceTurn) {
            supportBuilder.withTableInfoActions(announcePlayers, announceTurn);
            return this;
        }

        public Builder withBotActions(Supplier<CompletableFuture<Void>> add,
                                      Supplier<CompletableFuture<Void>> remove) {
            supportBuilder.withBotActions(add, remove);
            return this;
        }

        public Builder withGuard(BooleanSupplier guard) {
            supportBuilder.withGuard(guard);
            return this;
        }

        public Builder withShortcutTargets(JComponent... targets) {
            supportBuilder.withShortcutTargets(targets);
            return this;
        }

        public GameScreenScaffold build() {
            GameScreenSupport support = supportBuilder.build();
            return new GameScreenScaffold(
                    support,
                    dialogService,
                    shortcutRegistry,
                    narrationQueueSupplier,
                    narrationPanel);
        }
    }
}
