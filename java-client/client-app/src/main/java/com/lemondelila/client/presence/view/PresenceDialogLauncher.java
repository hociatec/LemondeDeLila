package com.lemondelila.client.presence.view;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.presence.service.PresenceRealtimeService;
import com.lemondelila.client.presence.view.PresenceListDialogFactory;

import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.KeyboardFocusManager;
import java.awt.Window;
import java.util.Objects;

/**
 * Point central pour afficher la liste des joueurs connectés.
 * Garantit une seule fenêtre et s'occupe de gérer le thread Swing.
 */
public final class PresenceDialogLauncher {

    private final PresenceRealtimeService realtimeService;
    private final PresenceListDialogFactory dialogFactory;

    private PresenceListDialog currentDialog;

    @Inject
    public PresenceDialogLauncher(PresenceRealtimeService realtimeService,
                                  PresenceListDialogFactory dialogFactory) {
        this.realtimeService = Objects.requireNonNull(realtimeService, "realtimeService");
        this.dialogFactory = Objects.requireNonNull(dialogFactory, "dialogFactory");
    }

    public void show(Component anchor) {
        Runnable task = () -> {
            if (currentDialog != null && currentDialog.isDisplayable()) {
                currentDialog.setLocationRelativeTo(resolveOwner(anchor));
                currentDialog.toFront();
                return;
            }

            Window owner = resolveOwner(anchor);
            PresenceListDialog dialog = dialogFactory.create(owner, () -> currentDialog = null);
            currentDialog = dialog;
            dialog.pack();
            dialog.setVisible(true);
        };

        if (SwingUtilities.isEventDispatchThread()) {
            task.run();
        } else {
            SwingUtilities.invokeLater(task);
        }
    }

    private Window resolveOwner(Component anchor) {
        if (anchor instanceof Window window) {
            return window;
        }
        Window parent = anchor != null ? SwingUtilities.getWindowAncestor(anchor) : null;
        if (parent != null) {
            return parent;
        }
        return KeyboardFocusManager.getCurrentKeyboardFocusManager().getActiveWindow();
    }
}


