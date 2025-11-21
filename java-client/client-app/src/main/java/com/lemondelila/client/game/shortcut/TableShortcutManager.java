package com.lemondelila.client.game.shortcut;

import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.game.core.FocusCycleManager;

import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.ActionMap;
import javax.swing.InputMap;
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
     * @param container composant racine qui re��oit la description des raccourcis (inutile pour le cycle)
     * @param focusAreas zones focusables (ordre de cycle)
     */
    public void installNavigation(JComponent container, JComponent... focusAreas) {
        Objects.requireNonNull(focusAreas, "focusAreas");
        if (container != null) {
            shortcuts.applyTo(container);
        }
        new FocusCycleManager(shortcuts, focusAreas).install();
    }

    public void registerShortcut(javax.swing.KeyStroke stroke, String description) {
        shortcuts.register(stroke, description);
    }

    /**
     * Raccourci quitter (ex : 'q') sur un composant racine.
     */
    public void bindQuit(JComponent root, Runnable onQuit) {
        Objects.requireNonNull(root, "root");
        Objects.requireNonNull(onQuit, "onQuit");
        KeyStroke quitStroke = KeyStroke.getKeyStroke('q');
        registerShortcut(quitStroke, "Quitter la table");
        InputMap map = root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actions = root.getActionMap();
        map.put(quitStroke, "table.quit");
        actions.put("table.quit", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                onQuit.run();
            }
        });
    }
}