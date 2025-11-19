package com.lemondelila.client.application;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.branding.AppBrandingProvider;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;

@AutoService(LilaModule.class)
public final class AppBrandingModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(AppBranding.class);
        builder.bindFactory(AppBrandingProvider.class, ctx -> ctx.get(AppBranding.class));
    }

    @Override
    public int order() {
        return 5;
    }
}
