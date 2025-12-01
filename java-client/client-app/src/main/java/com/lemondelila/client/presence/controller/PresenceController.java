package com.lemondelila.client.presence.controller;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.core.util.SimpleRateLimiter;
import com.lemondelila.client.presence.view.PresenceDialogLauncher;
import com.lemondelila.client.user.model.ClientSession;

import java.awt.Component;
import java.util.Objects;

/**
 * Handles presence dialog orchestration.
 */
public final class PresenceController {

    private final PresenceDialogLauncher dialogLauncher;
    private final DialogService dialogService;
    private final ClientSession session;
    private final SimpleRateLimiter rateLimiter = new SimpleRateLimiter(1500);

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
     * @return résultat à appliquer (message, navigation ...).
     */
    public ControllerResult open(Component anchor) {
        if (!rateLimiter.tryAcquire()) {
            return ControllerResult.status(Internationalization.text("presence.status.open"));
        }
        if (session.authenticated().isEmpty()) {
            dialogService.error(
                    Internationalization.text("presence.auth.required.title"),
                    Internationalization.text("presence.auth.required.body"));
            return ControllerResult.status(Internationalization.text("presence.status.auth"));
        }
        dialogLauncher.show(anchor);
        return ControllerResult.status(Internationalization.text("presence.status.open"));
    }
}
