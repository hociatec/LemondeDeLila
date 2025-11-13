package com.lemondelila.client.social.view;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.MessagingService;
import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.user.model.ClientSession;

import javax.swing.SwingUtilities;
import java.awt.Component;
import java.awt.KeyboardFocusManager;
import java.awt.Window;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.Objects;

public final class SocialDialogLauncher {

    private final UserRelationshipService relationshipService;
    private final MessagingService messagingService;
    private final MessagingController messagingController;
    private final DialogService dialogService;
    private final ClientSession session;

    private SocialCenterDialog currentDialog;

    @Inject
    public SocialDialogLauncher(UserRelationshipService relationshipService,
                                MessagingService messagingService,
                                MessagingController messagingController,
                                DialogService dialogService,
                                ClientSession session) {
        this.relationshipService = Objects.requireNonNull(relationshipService, "relationshipService");
        this.messagingService = Objects.requireNonNull(messagingService, "messagingService");
        this.messagingController = Objects.requireNonNull(messagingController, "messagingController");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.session = Objects.requireNonNull(session, "session");
    }

    public void show(Component anchor) {
        SwingUtilities.invokeLater(() -> {
            if (currentDialog != null && currentDialog.isDisplayable()) {
                currentDialog.setLocationRelativeTo(resolveOwner(anchor));
                currentDialog.toFront();
                currentDialog.requestFocus();
                return;
            }

            Window owner = resolveOwner(anchor);
            SocialCenterDialog dialog = new SocialCenterDialog(
                    owner,
                    relationshipService,
                    messagingService,
                    messagingController,
                    dialogService,
                    session
            );
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
