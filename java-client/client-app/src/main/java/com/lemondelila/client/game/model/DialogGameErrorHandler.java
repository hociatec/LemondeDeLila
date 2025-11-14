package com.lemondelila.client.game.model;

import com.lemondelila.client.framework.ui.dialog.DialogService;

import javax.swing.SwingUtilities;
import java.util.Objects;

public final class DialogGameErrorHandler {

    private final DialogService dialogService;
    private final String title;

    public DialogGameErrorHandler(DialogService dialogService, String title) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.title = Objects.requireNonNull(title, "title");
    }

    public void show(String context, Throwable error) {
        String message = GameErrors.describe(error);
        SwingUtilities.invokeLater(() ->
                dialogService.error(title, context + " : " + message)
        );
    }

    public void show(Throwable error) {
        String message = GameErrors.describe(error);
        SwingUtilities.invokeLater(() ->
                dialogService.error(title, message)
        );
    }
}
