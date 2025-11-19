package com.lemondelila.client.presence.view;

import java.awt.Window;

public interface PresenceListDialogFactory {

    PresenceListDialog create(Window owner, Runnable onClose);
}
