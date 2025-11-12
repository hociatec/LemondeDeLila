package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.framework.ui.dialog.DialogService;

import javax.swing.SwingUtilities;
import java.util.Objects;

/**
 * Gère l'affichage des erreurs liées à Panier Express.
 */
final class PanierExpressErrorHandler {

    private final DialogService dialogService;

    PanierExpressErrorHandler(DialogService dialogService) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
    }

    void showError(Throwable error) {
        Throwable root = unwrap(error);
        String message = root.getMessage() != null ? root.getMessage() : root.toString();
        SwingUtilities.invokeLater(() ->
                dialogService.error("Panier Express", "Erreur de partie : " + message)
        );
    }

    private static Throwable unwrap(Throwable error) {
        if (error == null) {
            return new IllegalStateException("Erreur inconnue");
        }
        Throwable current = error;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current;
    }
}

