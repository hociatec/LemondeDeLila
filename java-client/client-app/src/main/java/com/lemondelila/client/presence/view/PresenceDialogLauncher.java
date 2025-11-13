package com.lemondelila.client.presence.view;

import com.lemondelila.client.chat.service.ChatConnectionFactory;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.UserRelationshipService;

import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.KeyboardFocusManager;
import java.awt.Window;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.Objects;

/**
 * Point central pour afficher la liste des joueurs connectés.
 * Garantit une seule fenêtre et s'occupe de gérer le thread Swing.
 */
public final class PresenceDialogLauncher {

    private final ChatConnectionFactory connectionFactory;
    private final DialogService dialogService;
    private final MessagingController messagingController;
    private final UserRelationshipService relationshipService;

    private PresenceListDialog currentDialog;

    @Inject
    public PresenceDialogLauncher(ChatConnectionFactory connectionFactory,
                                  DialogService dialogService,
                                  MessagingController messagingController,
                                  UserRelationshipService relationshipService) {
        this.connectionFactory = Objects.requireNonNull(connectionFactory, "connectionFactory");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.messagingController = Objects.requireNonNull(messagingController, "messagingController");
        this.relationshipService = Objects.requireNonNull(relationshipService, "relationshipService");
    }

    public void show(Component anchor) {
        SwingUtilities.invokeLater(() -> {
            if (currentDialog != null && currentDialog.isDisplayable()) {
                currentDialog.setLocationRelativeTo(resolveOwner(anchor));
                currentDialog.toFront();
                return;
            }

            Window owner = resolveOwner(anchor);
            PresenceListDialog dialog = new PresenceListDialog(
                    owner,
                    connectionFactory,
                    dialogService,
                    messagingController,
                    relationshipService);
            dialog.addWindowListener(new WindowAdapter() {
                @Override
                public void windowClosed(WindowEvent e) {
                    currentDialog = null;
                }
            });
            currentDialog = dialog;
            dialog.setVisible(true);
        });
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


