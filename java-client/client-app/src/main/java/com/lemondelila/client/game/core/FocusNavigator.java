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
 * Navigation clavier (Tab / Shift+Tab) centralisée entre plusieurs zones.
 */
public final class FocusNavigator {

    private final AccessibleShortcutRegistry shortcuts;

    public FocusNavigator(AccessibleShortcutRegistry shortcuts) {
        this.shortcuts = Objects.requireNonNull(shortcuts, "shortcuts");
    }

    public void install(JComponent... areas) {
        JComponent[] targets = Arrays.stream(areas)
                .filter(Objects::nonNull)
                .toArray(JComponent[]::new);
        if (targets.length < 2) {
            return;
        }
        shortcuts.register(KeyStroke.getKeyStroke("TAB"), "Zone suivante");
        shortcuts.register(KeyStroke.getKeyStroke("shift TAB"), "Zone precedente");
        for (JComponent area : targets) {
            disableTraversal(area);
            InputMap focusMap = area.getInputMap(JComponent.WHEN_FOCUSED);
            InputMap ancestorMap = area.getInputMap(JComponent.WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
            ActionMap actions = area.getActionMap();
            focusMap.put(KeyStroke.getKeyStroke("TAB"), "cycle.next");
            focusMap.put(KeyStroke.getKeyStroke("shift TAB"), "cycle.prev");
            ancestorMap.put(KeyStroke.getKeyStroke("TAB"), "cycle.next");
            ancestorMap.put(KeyStroke.getKeyStroke("shift TAB"), "cycle.prev");
            actions.put("cycle.next", new AbstractAction() {
                @Override
                public void actionPerformed(java.awt.event.ActionEvent e) {
                    focusRelative(targets, 1);
                }
            });
            actions.put("cycle.prev", new AbstractAction() {
                @Override
                public void actionPerformed(java.awt.event.ActionEvent e) {
                    focusRelative(targets, -1);
                }
            });
        }
    }

    private void disableTraversal(JComponent root) {
        root.setFocusTraversalKeysEnabled(false);
        for (Component child : root.getComponents()) {
            if (child instanceof JComponent jc) {
                disableTraversal(jc);
            }
        }
    }

    private void focusRelative(JComponent[] areas, int delta) {
        Component focusOwner = KeyboardFocusManager.getCurrentKeyboardFocusManager().getFocusOwner();
        int currentIndex = 0;
        if (focusOwner != null) {
            for (int i = 0; i < areas.length; i++) {
                if (SwingUtilities.isDescendingFrom(focusOwner, areas[i])) {
                    currentIndex = i;
                    break;
                }
            }
        }
        int next = (currentIndex + delta + areas.length) % areas.length;
        areas[next].requestFocusInWindow();
    }
}
