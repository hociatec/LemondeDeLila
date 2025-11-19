package com.lemondelila.client.presence.view;

import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.presence.service.PresenceRealtimeService;

import javax.inject.Inject;
import java.awt.Window;
import java.util.Objects;

public final class DefaultPresenceListDialogFactory implements PresenceListDialogFactory {

    private final DialogService dialogService;
    private final MessagingController messagingController;
    private final UserRelationshipService relationshipService;
    private final PresenceRealtimeService realtimeService;

    @Inject
    public DefaultPresenceListDialogFactory(DialogService dialogService,
                                            MessagingController messagingController,
                                            UserRelationshipService relationshipService,
                                            PresenceRealtimeService realtimeService) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.messagingController = Objects.requireNonNull(messagingController, "messagingController");
        this.relationshipService = Objects.requireNonNull(relationshipService, "relationshipService");
        this.realtimeService = Objects.requireNonNull(realtimeService, "realtimeService");
    }

    @Override
    public PresenceListDialog create(Window owner, Runnable onClose) {
        PresenceListDialog dialog = new PresenceListDialog(
                owner,
                dialogService,
                messagingController,
                relationshipService,
                realtimeService
        );
        dialog.addWindowListener(new java.awt.event.WindowAdapter() {
            @Override
            public void windowClosed(java.awt.event.WindowEvent e) {
                if (onClose != null) {
                    onClose.run();
                }
            }
        });
        return dialog;
    }
}
