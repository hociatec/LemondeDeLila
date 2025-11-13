package com.lemondelila.client.presence.controller;

import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.presence.view.PresenceDialogLauncher;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.dialog.DialogService;

import java.awt.Component;
import java.util.Objects;

/**
 * Handles presence dialog orchestration.
 */
public final class PresenceController {

    private final PresenceDialogLauncher dialogLauncher;
    private final DialogService dialogService;
    private final ClientSession session;

    @Inject
    public PresenceController(PresenceDialogLauncher dialogLauncher,
                              DialogService dialogService,
                              ClientSession session) {
        this.dialogLauncher = Objects.requireNonNull(dialogLauncher, "dialogLauncher");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.session = Objects.requireNonNull(session, "session");
    }

    /**
     * Opens the presence dialog if the user is authenticated.
     *
     * @param anchor component used to position the dialog.
     * @return status message for the view.
     */
    public String open(Component anchor) {
        if (session.authenticated().isEmpty()) {
            dialogService.error("Authentification requise", "Veuillez vous reconnecter pour acceder a la presence.");
            return "Connexion requise pour voir la presence.";
        }
        dialogLauncher.show(anchor);
        return "Liste des connectes ouverte.";
    }
}
