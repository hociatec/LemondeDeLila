package com.lemondelila.client.game.room.service;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.room.model.PendingRoomInvites;
import com.lemondelila.client.game.room.model.RoomInvite;

import javax.swing.SwingUtilities;
import java.util.Objects;

/**
 * Permet d'accepter rapidement la dernière invitation reçue (raccourci global).
 */
public final class RoomInviteAcceptanceService {

    private final PendingRoomInvites inviteStore;
    private final com.lemondelila.client.game.room.browser.controller.RoomBrowserController roomBrowserController;
    private final DialogService dialogService;
    private final ScreenManager screenManager;

    @Inject
    public RoomInviteAcceptanceService(PendingRoomInvites inviteStore,
                                       com.lemondelila.client.game.room.browser.controller.RoomBrowserController roomBrowserController,
                                       DialogService dialogService,
                                       ScreenManager screenManager) {
        this.inviteStore = Objects.requireNonNull(inviteStore, "inviteStore");
        this.roomBrowserController = Objects.requireNonNull(roomBrowserController, "roomBrowserController");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.screenManager = Objects.requireNonNull(screenManager, "screenManager");
    }

    /**
     * Accepte la dernière invitation disponible.
     *
     * @return true si une invitation a été trouvée (succès ou erreur affichée), false sinon.
     */
    public boolean acceptLatest() {
        RoomInvite invite = inviteStore.latest();
        if (invite == null) {
            return false;
        }
        ControllerResult result = roomBrowserController.acceptInviteAndOpenTable(invite.invitationId());
        result.statusMessage().ifPresent(msg -> dialogService.info("Invitation", msg));
        result.navigationTarget().ifPresent(target -> SwingUtilities.invokeLater(() -> screenManager.show(target)));
        return true;
    }
}
