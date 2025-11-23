package com.lemondelila.client.game.core.service;

import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.core.di.Inject;

import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.KeyboardFocusManager;
import java.awt.event.KeyEvent;
import java.util.Objects;

/**
 * Service utilitaire pour naviguer entre zones focusables (Tab/Shift+Tab).
 */
public final class FocusNavigator {

    private final AccessibleShortcutRegistry shortcuts;

    @Inject
    public FocusNavigator(AccessibleShortcutRegistry shortcuts) {
        this.shortcuts = Objects.requireNonNull(shortcuts, "shortcuts");
    }

    public void install(JComponent root, JComponent... focusAreas) {
        if (focusAreas == null || focusAreas.length == 0) {
            return;
        }
        if (root != null) {
            root.setFocusTraversalKeysEnabled(false);
        }
        // Bind global Tab/Shift+Tab on a shared target and mirror the bindings on each zone.
        JComponent target = root != null ? root : focusAreas[0];
        KeyStroke next = KeyStroke.getKeyStroke(KeyEvent.VK_TAB, 0);
        KeyStroke prev = KeyStroke.getKeyStroke(KeyEvent.VK_TAB, java.awt.event.InputEvent.SHIFT_DOWN_MASK);
        javax.swing.InputMap map = target.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        javax.swing.ActionMap actions = target.getActionMap();
        javax.swing.AbstractAction nextAction = new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                int idx = currentIndex(focusAreas);
                int nextIndex = (idx + 1) % focusAreas.length;
                KeyboardFocusManager.getCurrentKeyboardFocusManager().clearGlobalFocusOwner();
                focusAreas[nextIndex].requestFocusInWindow();
            }
        };
        javax.swing.AbstractAction prevAction = new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                int idx = currentIndex(focusAreas);
                int prevIndex = (idx - 1 + focusAreas.length) % focusAreas.length;
                KeyboardFocusManager.getCurrentKeyboardFocusManager().clearGlobalFocusOwner();
                focusAreas[prevIndex].requestFocusInWindow();
            }
        };
        map.put(next, "focus.next.global");
        map.put(prev, "focus.prev.global");
        actions.put("focus.next.global", nextAction);
        actions.put("focus.prev.global", prevAction);

        // Réplique les KeyStrokes et actions sur chaque zone
        for (JComponent area : focusAreas) {
            if (area == null) continue;
            area.setFocusTraversalKeysEnabled(false);
            javax.swing.InputMap mapFocused = area.getInputMap(JComponent.WHEN_FOCUSED);
            javax.swing.InputMap mapAncestor = area.getInputMap(JComponent.WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
            mapFocused.put(next, "focus.next.global");
            mapFocused.put(prev, "focus.prev.global");
            mapAncestor.put(next, "focus.next.global");
            mapAncestor.put(prev, "focus.prev.global");
            javax.swing.ActionMap areaActions = area.getActionMap();
            areaActions.put("focus.next.global", nextAction);
            areaActions.put("focus.prev.global", prevAction);
        }
    }

    private int currentIndex(JComponent[] focusAreas) {
        Component focusOwner = KeyboardFocusManager.getCurrentKeyboardFocusManager().getFocusOwner();
        if (focusOwner != null) {
            for (int i = 0; i < focusAreas.length; i++) {
                if (focusAreas[i] == focusOwner || SwingUtilities.isDescendingFrom(focusOwner, focusAreas[i])) {
                    return i;
                }
            }
        }
        return 0;
    }

    public void registerShortcut(KeyStroke stroke, String description) {
        shortcuts.register(stroke, description);
    }
}
