package com.lemondelila.client.game.shortcut;

import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.core.di.Inject;

import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import java.util.Objects;

/**
 * Raccourcis du catalogue (ex : Echap pour remonter).
 */
public final class CatalogShortcuts {

    private final AccessibleShortcutRegistry shortcuts;

    @Inject
    public CatalogShortcuts(AccessibleShortcutRegistry shortcuts) {
        this.shortcuts = Objects.requireNonNull(shortcuts, "shortcuts");
    }

    public void bindEscape(JComponent root, Runnable onEscape) {
        Objects.requireNonNull(root, "root");
        Objects.requireNonNull(onEscape, "onEscape");
        KeyStroke escape = KeyStroke.getKeyStroke("ESCAPE");
        shortcuts.register(escape, "Revenir en arriere");

        InputMap inputMap = root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actionMap = root.getActionMap();
        inputMap.put(escape, "catalog.escape");
        actionMap.put("catalog.escape", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                onEscape.run();
            }
        });
    }
}
