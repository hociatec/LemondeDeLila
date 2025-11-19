package com.lemondelila.client.game.service;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.access.shortcut.ShortcutBinder;
import com.lemondelila.client.framework.core.di.Inject;

import javax.swing.JComponent;
import java.util.Objects;
import java.util.function.BooleanSupplier;

/**
 * Centre de commandes clavier partagées pour tous les écrans de jeu.
 */
public final class GameCommandCenter {

    private final AccessibleShortcutRegistry shortcutRegistry;

    @Inject
    public GameCommandCenter(AccessibleShortcutRegistry shortcutRegistry) {
        this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
    }

    public ShortcutBinder createBinder(BooleanSupplier guard, JComponent... components) {
        return new ShortcutBinder(shortcutRegistry, guard, components);
    }

    public void registerCommonCommands(ShortcutBinder binder, GameCommandActions actions) {
        if (binder == null || actions == null) {
            return;
        }
        binder.registerLetter('q',
                "game.command.quit",
                Internationalization.text("game.command.quit.desc"),
                e -> actions.onQuit());
        binder.registerLetter('x',
                "game.command.restart",
                Internationalization.text("game.command.restart.desc"),
                e -> actions.onRestart());
        binder.registerStroke("F1",
                "game.command.rules",
                Internationalization.text("game.command.rules.desc"),
                e -> actions.onShowRules());
        binder.registerLetter('w',
                "game.command.who",
                Internationalization.text("game.command.who.desc"),
                e -> actions.onShowPlayers());
    }
}
