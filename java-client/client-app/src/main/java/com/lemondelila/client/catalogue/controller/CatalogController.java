package com.lemondelila.client.catalogue.controller;

import com.lemondelila.client.catalogue.view.CatalogScreen;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.user.model.ClientSession;

import java.util.Objects;

/**
 * Handles navigation to the catalogue screen.
 */
public final class CatalogController {

    private final ClientSession session;
    private final DialogService dialogService;

    @Inject
    public CatalogController(ClientSession session, DialogService dialogService) {
        this.session = Objects.requireNonNull(session, "session");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
    }

    /**
     * Requests navigation to the catalogue.
     */
    public ControllerResult openCatalog() {
        if (session.authenticated().isEmpty()) {
            dialogService.error("Authentification requise", "Veuillez vous reconnecter pour acceder au catalogue.");
            return ControllerResult.status("Connexion requise pour ouvrir le catalogue.");
        }
        return ControllerResult.navigate(CatalogScreen.ID)
                .withStatus("Catalogue ouvert.");
    }
}
