package com.lemondelila.client.social.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.social.view.SocialCenterScreen;
import com.lemondelila.client.user.model.ClientSession;

import java.awt.Window;
import java.util.Objects;

public final class SocialController {

    private final DialogService dialogService;
    private final ClientSession session;

    @Inject
    public SocialController(DialogService dialogService,
                            ClientSession session) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.session = Objects.requireNonNull(session, "session");
    }

    /**
     * Opens the social center screen.
     *
     * @param owner parent window (unused).
     * @return result à appliquer par la vue.
     */
    public ControllerResult open(Window owner) {
        if (session.authenticated().isEmpty()) {
            dialogService.error("Centre social", "Veuillez vous reconnecter pour acceder a vos amis et messages.");
            return ControllerResult.status("Connexion requise pour acceder au centre social.");
        }
        return ControllerResult.navigate(SocialCenterScreen.ID)
                .withStatus("Centre social ouvert.");
    }
}
