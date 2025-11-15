package com.lemondelila.client.social;

import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.social.controller.SocialController;
import com.lemondelila.client.social.controller.SocialMessagesCenterController;
import com.lemondelila.client.social.controller.SocialRelationshipsController;
import com.lemondelila.client.social.view.SocialCenterScreen;

public final class SocialModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(SocialController.class);
        builder.bindAuto(SocialCenterScreen.class);
        builder.bindAuto(SocialRelationshipsController.class);
        builder.bindAuto(SocialMessagesCenterController.class);
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
