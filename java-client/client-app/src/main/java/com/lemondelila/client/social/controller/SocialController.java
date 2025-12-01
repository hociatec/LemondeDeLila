package com.lemondelila.client.social.controller;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.MessagingService;
import com.lemondelila.client.social.view.SocialMessagingDialog;

import javax.swing.SwingUtilities;
import java.awt.Window;
import java.util.Objects;

public final class SocialController {

    private final DialogService dialogService;
    private final MessagingService messagingService;
    private final MessagingController messagingController;

    public SocialController(DialogService dialogService,
                            MessagingService messagingService,
                            MessagingController messagingController) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.messagingService = Objects.requireNonNull(messagingService, "messagingService");
        this.messagingController = Objects.requireNonNull(messagingController, "messagingController");
    }

    public void openMessaging(Window owner) {
        SwingUtilities.invokeLater(() -> {
            SocialMessagingDialog dialog = new SocialMessagingDialog(
                    owner,
                    dialogService,
                    messagingService,
                    messagingController
            );
            dialog.setLocationRelativeTo(owner);
            dialog.setVisible(true);
        });
    }

    public void openFriends(Window owner) {
        dialogService.info(
                Internationalization.text("social.friends.title"),
                Internationalization.text("social.friends.notavailable"));
    }
}
