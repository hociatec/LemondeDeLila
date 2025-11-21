package com.lemondelila.client.game.shortcut;

import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.game.core.FocusNavigator;

import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.util.Objects;

/**
 * Centralise les raccourcis claviers propres aux tables de jeu.
 */
public final class TableShortcutManager {

    private final AccessibleShortcutRegistry shortcuts;
    private final FocusNavigator navigator;

    @Inject
    public TableShortcutManager(AccessibleShortcutRegistry shortcuts) {
        this.shortcuts = Objects.requireNonNull(shortcuts, "shortcuts");
        this.navigator = new FocusNavigator(shortcuts);
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
        navigator.install(focusAreas);
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

    /**
     * Raccourcis bots (b pour ajouter, shift+b pour retirer).
     */
    public void bindBotShortcuts(JComponent root, Runnable onAdd, Runnable onRemove) {
        Objects.requireNonNull(root, "root");
        Objects.requireNonNull(onAdd, "onAdd");
        Objects.requireNonNull(onRemove, "onRemove");
        KeyStroke add = KeyStroke.getKeyStroke(KeyEvent.VK_B, 0);
        KeyStroke remove = KeyStroke.getKeyStroke(KeyEvent.VK_B, InputEvent.SHIFT_DOWN_MASK);
        registerShortcut(add, "Ajouter un bot");
        registerShortcut(remove, "Retirer un bot");
        InputMap windowMap = root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actions = root.getActionMap();
        windowMap.put(add, "table.bot.add");
        windowMap.put(remove, "table.bot.remove");
        actions.put("table.bot.add", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                onAdd.run();
            }
        });
        actions.put("table.bot.remove", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                onRemove.run();
            }
        });
    }

    /**
     * Raccourci r��capitulatif (ex : 'w') sur un composant racine.
     */
    public void bindSummary(JComponent root, Runnable onSummary) {
        Objects.requireNonNull(root, "root");
        Objects.requireNonNull(onSummary, "onSummary");
        KeyStroke summary = KeyStroke.getKeyStroke(KeyEvent.VK_W, 0);
        registerShortcut(summary, "Afficher les informations de table");
        InputMap windowMap = root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actions = root.getActionMap();
        windowMap.put(summary, "table.summary");
        actions.put("table.summary", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                onSummary.run();
            }
        });
    }
}
