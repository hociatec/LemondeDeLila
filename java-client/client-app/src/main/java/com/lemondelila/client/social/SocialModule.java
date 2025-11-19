package com.lemondelila.client.social;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.social.controller.SocialController;
import com.lemondelila.client.social.controller.SocialMessagesCenterController;
import com.lemondelila.client.social.controller.SocialRelationshipsController;
import com.lemondelila.client.social.view.DefaultSocialMessagesPanelFactory;
import com.lemondelila.client.social.view.DefaultSocialRelationshipsContainerFactory;
import com.lemondelila.client.social.view.SocialCenterScreen;
import com.lemondelila.client.social.view.SocialMessagesPanelFactory;
import com.lemondelila.client.social.view.SocialRelationshipsContainerFactory;

@AutoService(LilaModule.class)
public final class SocialModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(SocialController.class);
        builder.bindAuto(SocialRelationshipsController.class);
        builder.bindAuto(SocialMessagesCenterController.class);
        builder.bindAuto(DefaultSocialRelationshipsContainerFactory.class);
        builder.bindFactory(SocialRelationshipsContainerFactory.class, ctx -> ctx.get(DefaultSocialRelationshipsContainerFactory.class));
        builder.bindAuto(DefaultSocialMessagesPanelFactory.class);
        builder.bindFactory(SocialMessagesPanelFactory.class, ctx -> ctx.get(DefaultSocialMessagesPanelFactory.class));
        builder.bindAuto(SocialCenterScreen.class);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(SocialController.class);
    }

    @Override
    public int order() {
        return 45;
    }
}
