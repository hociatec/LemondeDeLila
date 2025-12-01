package com.lemondelila.client.framework.ui.keyboard;

import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import java.awt.event.ActionEvent;

public final class KeyboardBindings {

    private KeyboardBindings() { }

    /**
     * Disable default TAB/SHIFT+TAB focus traversal on the given component.
     */
    public static void disableTabTraversal(JComponent component) {
        if (component != null) {
            component.setFocusTraversalKeysEnabled(false);
        }
    }

    /**
     * Bind ENTER to run a custom action.
     */
    public static void bindEnter(JComponent component, Runnable action, String name) {
        if (component == null || action == null) {
            return;
        }
        String key = name == null || name.isBlank() ? "kb.enter" : name;
        component.getInputMap(JComponent.WHEN_FOCUSED)
                .put(KeyStroke.getKeyStroke("ENTER"), key);
        component.getActionMap()
                .put(key, new AbstractAction() {
                    @Override
                    public void actionPerformed(ActionEvent e) {
                        action.run();
                    }
                });
    }
}
