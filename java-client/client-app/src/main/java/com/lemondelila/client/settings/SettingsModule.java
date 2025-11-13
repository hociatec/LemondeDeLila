package com.lemondelila.client.settings;

import com.lemondelila.client.settings.controller.OptionsController;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;

public final class SettingsModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(AppSettingsService.class);
        builder.bindAuto(OptionsController.class);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(OptionsController.class);
    }

    @Override
    public int order() {
        return 10;
    }
}
