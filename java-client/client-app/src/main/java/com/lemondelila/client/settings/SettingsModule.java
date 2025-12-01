package com.lemondelila.client.settings;

import com.google.auto.service.AutoService;
import com.lemondelila.client.settings.controller.OptionsController;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.settings.storage.UserStoragePaths;
import com.lemondelila.client.settings.update.UpdateService;
import com.lemondelila.client.settings.view.DefaultOptionsDialogFactory;
import com.lemondelila.client.settings.view.OptionsDialogFactory;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;

@AutoService(LilaModule.class)
public final class SettingsModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(UserStoragePaths.class);
        builder.bindAuto(AppSettingsService.class);
        builder.bindAuto(UpdateService.class);
        builder.bindAuto(DefaultOptionsDialogFactory.class);
        builder.bindFactory(OptionsDialogFactory.class, ctx -> ctx.get(DefaultOptionsDialogFactory.class));
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
