package com.lemondelila.client.game.core;

import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.KeyboardFocusManager;
import java.util.Arrays;
import java.util.Objects;

/**
 * Gere une navigation circulaire au clavier (Tab / Shift+Tab) entre plusieurs zones.
 */
public final class FocusCycleManager {

    private final AccessibleShortcutRegistry shortcuts;
    private final JComponent[] areas;

    public FocusCycleManager(AccessibleShortcutRegistry shortcuts, JComponent... areas) {
        this.shortcuts = Objects.requireNonNull(shortcuts, "shortcuts");
        this.areas = Arrays.stream(areas)
                .filter(Objects::nonNull)
                .toArray(JComponent[]::new);
    }

    public void install() {
        if (areas.length < 2) {
            return;
        }
        shortcuts.register(KeyStroke.getKeyStroke("TAB"), "Basculer vers la zone suivante");
        shortcuts.register(KeyStroke.getKeyStroke("shift TAB"), "Revenir a la zone precedente");

        for (JComponent area : areas) {
            disableTraversal(area);
            InputMap focusMap = area.getInputMap(JComponent.WHEN_FOCUSED);
            InputMap ancestorMap = area.getInputMap(JComponent.WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
            ActionMap actionMap = area.getActionMap();
            focusMap.put(KeyStroke.getKeyStroke("TAB"), "cycle.next");
            focusMap.put(KeyStroke.getKeyStroke("shift TAB"), "cycle.prev");
            ancestorMap.put(KeyStroke.getKeyStroke("TAB"), "cycle.next");
            ancestorMap.put(KeyStroke.getKeyStroke("shift TAB"), "cycle.prev");
            actionMap.put("cycle.next", new AbstractAction() {
                @Override
                public void actionPerformed(java.awt.event.ActionEvent e) {
                    focusNext();
                }
            });
            actionMap.put("cycle.prev", new AbstractAction() {
                @Override
                public void actionPerformed(java.awt.event.ActionEvent e) {
                    focusPrevious();
                }
            });
        }
    }

    private void focusNext() {
        focusRelative(1);
    }

    private void focusPrevious() {
        focusRelative(-1);
    }

    private void focusRelative(int delta) {
        if (areas.length == 0) {
            return;
        }
        Component focusOwner = KeyboardFocusManager.getCurrentKeyboardFocusManager().getFocusOwner();
        int currentIndex = indexOfAreaContaining(focusOwner);
        int nextIndex = (currentIndex + delta + areas.length) % areas.length;
        JComponent target = areas[nextIndex];
        JComponent focusable = findFocusable(target);
        if (focusable != null) {
            focusable.requestFocusInWindow();
        } else {
            target.requestFocusInWindow();
        }
    }

    private int indexOfAreaContaining(Component focusOwner) {
        if (focusOwner == null) {
            return 0;
        }
        for (int i = 0; i < areas.length; i++) {
            if (SwingUtilities.isDescendingFrom(focusOwner, areas[i])) {
                return i;
            }
        }
        return 0;
    }

    private void disableTraversal(JComponent root) {
        root.setFocusTraversalKeysEnabled(false);
        for (Component child : root.getComponents()) {
            if (child instanceof JComponent component) {
                disableTraversal(component);
            }
        }
    }

    private JComponent findFocusable(JComponent root) {
        if (root.isFocusable() && root.isEnabled() && root.isShowing()) {
            return root;
        }
        for (Component child : root.getComponents()) {
            if (child instanceof JComponent component) {
                JComponent candidate = findFocusable(component);
                if (candidate != null) {
                    return candidate;
                }
            }
        }
        return null;
    }
}
