package com.lemondelila.client.game.shortcut.controller;

import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.game.core.service.FocusNavigator;
import com.lemondelila.client.game.shortcut.model.ShortcutEntry;

import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import java.awt.event.InputEvent;
import java.awt.event.KeyEvent;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Centralise les raccourcis claviers propres aux tables de jeu.
 */
public final class TableShortcutManager {

    private final AccessibleShortcutRegistry shortcuts;
    private final FocusNavigator navigator;
    private final List<ShortcutEntry> entries = new ArrayList<>();

    @Inject
    public TableShortcutManager(AccessibleShortcutRegistry shortcuts) {
        this.shortcuts = Objects.requireNonNull(shortcuts, "shortcuts");
        this.navigator = new FocusNavigator(shortcuts);
    }

    /**
     * Installe la navigation de base (Tab / Shift+Tab) entre les zones.
     * @param container composant racine qui re�oit la description des raccourcis (inutile pour le cycle)
     * @param focusAreas zones focusables (ordre de cycle)
     */
    public void installNavigation(JComponent container, JComponent... focusAreas) {
        Objects.requireNonNull(focusAreas, "focusAreas");
        if (container != null) {
            shortcuts.applyTo(container);
        }
        navigator.install(container, focusAreas);
    }

    public void registerShortcut(javax.swing.KeyStroke stroke, String description) {
        shortcuts.register(stroke, description);
        if (stroke != null && description != null) {
            entries.add(new ShortcutEntry(stroke.toString(), description));
        }
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
     * Raccourci pour basculer la confidentialite (Ctrl+H).
     */
    public void bindPrivacyToggle(JComponent root, Runnable onToggle) {
        Objects.requireNonNull(root, "root");
        Objects.requireNonNull(onToggle, "onToggle");
        KeyStroke toggle = KeyStroke.getKeyStroke(KeyEvent.VK_H, InputEvent.CTRL_DOWN_MASK);
        registerShortcut(toggle, "Rendre la table publique/privee");
        InputMap windowMap = root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actions = root.getActionMap();
        windowMap.put(toggle, "table.privacy.toggle");
        actions.put("table.privacy.toggle", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                onToggle.run();
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
     * Raccourci pour lancer la partie (Enter).
     */
    public void bindLaunch(JComponent root, Runnable onLaunch) {
        Objects.requireNonNull(root, "root");
        Objects.requireNonNull(onLaunch, "onLaunch");
        KeyStroke enter = KeyStroke.getKeyStroke(KeyEvent.VK_ENTER, 0);
        registerShortcut(enter, "Lancer la partie");
        InputMap windowMap = root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actions = root.getActionMap();
        windowMap.put(enter, "table.launch");
        actions.put("table.launch", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                onLaunch.run();
            }
        });
    }

    /**
     * Raccourci Echap pour sortir ou remonter.
     */
    public void bindEscape(JComponent root, Runnable onEscape) {
        Objects.requireNonNull(root, "root");
        Objects.requireNonNull(onEscape, "onEscape");
        KeyStroke esc = KeyStroke.getKeyStroke("ESCAPE");
        registerShortcut(esc, "Retour");
        InputMap map = root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actions = root.getActionMap();
        map.put(esc, "table.escape");
        actions.put("table.escape", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                onEscape.run();
            }
        });
    }

    /**
     * Raccourci r�capitulatif (ex : 'w') sur un composant racine.
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

    /**
     * Raccourci tour en cours (ex : 't') sur un composant racine.
     */
    public void bindTurnInfo(JComponent root, Runnable onTurnInfo) {
        Objects.requireNonNull(root, "root");
        Objects.requireNonNull(onTurnInfo, "onTurnInfo");
        KeyStroke turn = KeyStroke.getKeyStroke(KeyEvent.VK_T, 0);
        registerShortcut(turn, "Information de tour");
        InputMap windowMap = root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actions = root.getActionMap();
        windowMap.put(turn, "table.turn.info");
        actions.put("table.turn.info", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                onTurnInfo.run();
            }
        });
    }

    /**
     * Binde en une fois les raccourcis d'info (w pour participants, t pour tour en cours).
     */
    public void bindInfoShortcuts(JComponent root, Runnable onSummary, Runnable onTurnInfo) {
        bindSummary(root, onSummary);
        bindTurnInfo(root, onTurnInfo);
    }

    /**
     * Binde l'ensemble des raccourcis de table (infos, bots, quit) en une fois.
     */
    public void bindAll(JComponent root,
                        Runnable onSummary,
                        Runnable onTurnInfo,
                        Runnable onAddBot,
                        Runnable onRemoveBot,
                        Runnable onTogglePrivacy,
                        Runnable onLaunch,
                        Runnable onQuit) {
        bindInfoShortcuts(root, onSummary, onTurnInfo);
        bindBotShortcuts(root, onAddBot, onRemoveBot);
        bindPrivacyToggle(root, onTogglePrivacy);
        bindLaunch(root, onLaunch);
        bindQuit(root, onQuit);
    }

    /**
     * Fournit le modèle des raccourcis enregistrés (pour une éventuelle vue d'aide).
     */
    public List<ShortcutEntry> shortcutsModel() {
        return Collections.unmodifiableList(entries);
    }
}
