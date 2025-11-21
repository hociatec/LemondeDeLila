package com.lemondelila.client.social.controller;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.core.util.SimpleRateLimiter;
import com.lemondelila.client.social.view.SocialCenterScreen;
import com.lemondelila.client.user.model.ClientSession;

import java.awt.Window;
import java.util.Objects;

public final class SocialController {

    private final DialogService dialogService;
    private final ClientSession session;
    private final SimpleRateLimiter rateLimiter = new SimpleRateLimiter(1500);

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
        if (!rateLimiter.tryAcquire()) {
            return ControllerResult.status(Internationalization.text("social.status.open"));
        }
        if (session.authenticated().isEmpty()) {
            dialogService.error(
                    Internationalization.text("social.center.title"),
                    Internationalization.text("social.center.auth.body"));
            return ControllerResult.status(Internationalization.text("social.status.auth"));
        }
        return ControllerResult.navigate(SocialCenterScreen.ID)
                .withStatus(Internationalization.text("social.status.open"));
    }
}
