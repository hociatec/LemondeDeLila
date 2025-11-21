package com.lemondelila.client.game.shortcut;

import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.game.core.FocusCycleManager;

import javax.swing.JComponent;
import java.util.Objects;

/**
 * Centralise les raccourcis claviers propres aux tables de jeu.
 */
public final class TableShortcutManager {

    private final AccessibleShortcutRegistry shortcuts;

    @Inject
    public TableShortcutManager(AccessibleShortcutRegistry shortcuts) {
        this.shortcuts = Objects.requireNonNull(shortcuts, "shortcuts");
    }

    /**
     * Installe la navigation de base (Tab / Shift+Tab) entre les zones.
     */
    public void installNavigation(JComponent container, JComponent interactionArea, JComponent historyArea) {
        Objects.requireNonNull(interactionArea, "interactionArea");
        Objects.requireNonNull(historyArea, "historyArea");
        if (container != null) {
            shortcuts.applyTo(container);
        }
        new FocusCycleManager(shortcuts, interactionArea, historyArea).install();
    }
}
