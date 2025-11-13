package com.lemondelila.client.social;

import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.social.controller.SocialController;
import com.lemondelila.client.social.view.SocialDialogLauncher;

public final class SocialModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(SocialController.class);
        builder.bindAuto(SocialDialogLauncher.class);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(SocialController.class);
        context.get(SocialDialogLauncher.class);
    }

    @Override
    public int order() {
        return 45;
    }
}
