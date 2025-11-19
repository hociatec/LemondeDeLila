package com.lemondelila.client.messaging;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.MessagingService;
import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.messaging.view.DefaultPrivateConversationDialogFactory;
import com.lemondelila.client.messaging.view.PrivateConversationDialogFactory;

@AutoService(LilaModule.class)
public final class MessagingModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(MessagingService.class);
        builder.bindAuto(UserRelationshipService.class);
        builder.bindAuto(DefaultPrivateConversationDialogFactory.class);
        builder.bindFactory(PrivateConversationDialogFactory.class, ctx -> ctx.get(DefaultPrivateConversationDialogFactory.class));
        builder.bindAuto(MessagingController.class);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(MessagingController.class);
    }

    @Override
    public int order() {
        return 35; // after chat, before presence
    }
}
