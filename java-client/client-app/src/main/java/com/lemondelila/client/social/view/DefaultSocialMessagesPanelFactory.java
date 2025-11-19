package com.lemondelila.client.social.view;

import com.lemondelila.client.social.controller.SocialMessagesCenterController;
import com.lemondelila.client.framework.ui.dialog.DialogService;

import javax.inject.Inject;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Supplier;

public final class DefaultSocialMessagesPanelFactory implements SocialMessagesPanelFactory {

    private final SocialMessagesCenterController messagesController;
    private final DialogService dialogService;

    @Inject
    public DefaultSocialMessagesPanelFactory(SocialMessagesCenterController messagesController,
                                             DialogService dialogService) {
        this.messagesController = Objects.requireNonNull(messagesController, "messagesController");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
    }

    @Override
    public SocialMessagesPanel create(Supplier<java.awt.Window> ownerSupplier,
                                      Consumer<String> statusUpdater,
                                      Runnable onEscape) {
        SocialMessagesPanel panel = new SocialMessagesPanel(ownerSupplier, messagesController, dialogService, statusUpdater);
        panel.setOnEscape(onEscape);
        return panel;
    }
}
