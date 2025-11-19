package com.lemondelila.client.messaging.view;

import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.messaging.service.MessagingService;
import com.lemondelila.client.presence.model.PresencePlayer;

import javax.inject.Inject;
import java.util.Objects;

public final class DefaultPrivateConversationDialogFactory implements PrivateConversationDialogFactory {

    private final MessagingService messagingService;
    private final DialogService dialogService;

    @Inject
    public DefaultPrivateConversationDialogFactory(MessagingService messagingService,
                                                   DialogService dialogService) {
        this.messagingService = Objects.requireNonNull(messagingService, "messagingService");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
    }

    @Override
    public PrivateConversationDialog create(java.awt.Window owner,
                                            PresencePlayer player,
                                            Runnable onClose) {
        return new PrivateConversationDialog(owner, player, messagingService, dialogService, onClose);
    }
}
