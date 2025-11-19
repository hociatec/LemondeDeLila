package com.lemondelila.client.messaging.view;

import com.lemondelila.client.presence.model.PresencePlayer;

import java.awt.Window;
import java.util.function.Consumer;

public interface PrivateConversationDialogFactory {

    PrivateConversationDialog create(Window owner,
                                     PresencePlayer player,
                                     Runnable onClose);
}
