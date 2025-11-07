package com.lemondelila.client.controller.catalogue;

import com.lemondelila.client.model.user.ClientSession;
import com.lemondelila.framework.ui.dialog.DialogService;
import com.lemondelila.framework.ui.screen.ScreenManager;

import javax.swing.SwingUtilities;
import java.util.Objects;

/**
 * Handles navigation to the catalogue screen.
 */
public final class CatalogController {

    private final ClientSession session;
    private final DialogService dialogService;
    private ScreenManager screenManager;

    public CatalogController(ClientSession session, DialogService dialogService) {
        this.session = Objects.requireNonNull(session, "session");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
    }

    public void attach(ScreenManager manager) {
        this.screenManager = manager;
    }

    public void detach() {
        this.screenManager = null;
    }

    /**
     * Requests navigation to the catalogue.
     *
     * @return status message for the view.
     */
    public String openCatalog() {
        if (session.authenticated().isEmpty()) {
            dialogService.error("Authentification requise", "Veuillez vous reconnecter pour acceder au catalogue.");
            return "Connexion requise pour ouvrir le catalogue.";
        }
        ScreenManager manager = this.screenManager;
        if (manager != null) {
            SwingUtilities.invokeLater(() -> manager.show("catalog"));
        }
        return "Catalogue ouvert.";
    }
}
