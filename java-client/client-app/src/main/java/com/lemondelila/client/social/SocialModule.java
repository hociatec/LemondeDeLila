package com.lemondelila.client.social;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.MessagingService;
import com.lemondelila.client.social.controller.SocialController;
import com.lemondelila.client.social.controller.SocialPresenter;
import com.lemondelila.client.social.view.SocialScreen;
import com.lemondelila.client.social.view.SocialView;

@AutoService(LilaModule.class)
public final class SocialModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindFactory(SocialView.class, ctx -> new SocialView());
        builder.bindFactory(SocialController.class, ctx -> new SocialController(
                ctx.get(DialogService.class),
                ctx.get(MessagingService.class),
                ctx.get(MessagingController.class)
        ));
        builder.bindFactory(SocialPresenter.class, ctx -> new SocialPresenter(
                ctx.get(SocialView.class),
                ctx.get(SocialController.class)
        ));
        builder.bindAuto(SocialScreen.class);
    }

    @Override
    public int order() {
        return 50;
    }
}
