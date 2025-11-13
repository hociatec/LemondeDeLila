package com.lemondelila.client.social.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.social.view.SocialDialogLauncher;
import com.lemondelila.client.user.model.ClientSession;

import java.awt.Window;
import java.util.Objects;

public final class SocialController {

    private final DialogService dialogService;
    private final ClientSession session;
    private final SocialDialogLauncher dialogLauncher;

    @Inject
    public SocialController(DialogService dialogService,
                            ClientSession session,
                            SocialDialogLauncher dialogLauncher) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.session = Objects.requireNonNull(session, "session");
        this.dialogLauncher = Objects.requireNonNull(dialogLauncher, "dialogLauncher");
    }

    /**
     * Opens the social center dialog.
     *
     * @param owner parent window.
     * @return status message for the menu.
     */
    public String open(Window owner) {
        if (session.authenticated().isEmpty()) {
            dialogService.error("Centre social", "Veuillez vous reconnecter pour acceder a vos amis et messages.");
            return "Connexion requise pour acceder au centre social.";
        }
        dialogLauncher.show(owner);
        return "Centre social ouvert.";
    }
}
