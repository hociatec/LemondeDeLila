package com.lemondelila.client.application.view.shortcuts;

import com.lemondelila.client.presence.view.PresenceDialogLauncher;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.LilaFrame;
import com.lemondelila.client.framework.ui.action.ActionManager;

import javax.swing.AbstractAction;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.event.ActionEvent;
import java.util.HashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Regroupe la définition des raccourcis globaux de l'application.
 */
public final class ApplicationShortcuts {

    private final ActionManager actionManager;
    private final AccessibleShortcutRegistry shortcutRegistry;
    private final PresenceDialogLauncher presenceLauncher;

    private final Set<String> registeredIds = new HashSet<>();
    private boolean installed;
    private LilaFrame frameReference;

    @Inject
    public ApplicationShortcuts(ActionManager actionManager,
                                AccessibleShortcutRegistry shortcutRegistry,
                                PresenceDialogLauncher presenceLauncher) {
        this.actionManager = Objects.requireNonNull(actionManager, "actionManager");
        this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
        this.presenceLauncher = Objects.requireNonNull(presenceLauncher, "presenceLauncher");
    }

    public synchronized void install(LilaFrame frame) {
        if (installed) {
            return;
        }
        Objects.requireNonNull(frame, "frame");

        registerShortcut(
                "global.show-presence",
                "Ctrl+U",
                KeyStroke.getKeyStroke("control U"),
                "Afficher la liste des joueurs connectés",
                () -> presenceLauncher.show(frame)
        );

        installed = true;
        frameReference = frame;
        SwingUtilities.invokeLater(() -> {
            actionManager.attachTo(frame.getRootPane());
            shortcutRegistry.applyTo(frame.getRootPane());
        });
    }

    public void registerShortcut(String id,
                                 String mnemonic,
                                 KeyStroke keyStroke,
                                 String description,
                                 Runnable handler) {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(keyStroke, "keyStroke");
        Objects.requireNonNull(handler, "handler");

        if (!registeredIds.add(id)) {
            return;
        }

        actionManager.register(id, () -> new AbstractAction(id) {
            @Override
            public void actionPerformed(ActionEvent e) {
                handler.run();
            }
        }, keyStroke);

        shortcutRegistry.register(keyStroke, description + (mnemonic != null && !mnemonic.isBlank() ? " (" + mnemonic + ")" : ""));

        if (installed && frameReference != null) {
            SwingUtilities.invokeLater(() -> shortcutRegistry.applyTo(frameReference.getRootPane()));
        }
    }
}

