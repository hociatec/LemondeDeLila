package com.lemondelila.client.social.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.user.model.ClientSession;

import java.awt.Window;
import java.util.Objects;

public final class SocialController {

    private final DialogService dialogService;
    private final ClientSession session;
    private final ScreenManager screenManager;

    @Inject
    public SocialController(DialogService dialogService,
                            ClientSession session,
                            ScreenManager screenManager) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.session = Objects.requireNonNull(session, "session");
        this.screenManager = Objects.requireNonNull(screenManager, "screenManager");
    }

    /**
     * Opens the social center screen.
     *
     * @param owner parent window (unused).
     * @return status message for the menu.
     */
    public String open(Window owner) {
        if (session.authenticated().isEmpty()) {
            dialogService.error("Centre social", "Veuillez vous reconnecter pour acceder a vos amis et messages.");
            return "Connexion requise pour acceder au centre social.";
        }
        screenManager.show("social");
        return "Centre social ouvert.";
    }
}
