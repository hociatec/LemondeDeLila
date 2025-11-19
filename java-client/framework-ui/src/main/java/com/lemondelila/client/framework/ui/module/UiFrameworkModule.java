package com.lemondelila.client.framework.ui.module;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.ui.LilaFrame;
import com.lemondelila.client.framework.ui.action.ActionManager;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.lifecycle.ApplicationLifecycle;
import com.lemondelila.client.framework.ui.lifecycle.DialogBackedApplicationLifecycle;
import com.lemondelila.client.framework.ui.lifecycle.ShutdownManager;
import com.lemondelila.client.framework.ui.menu.MenuFactory;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.framework.ui.component.StatusBannerFactory;

@AutoService(LilaModule.class)
public final class UiFrameworkModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(ActionManager.class);
        builder.bindAuto(DialogService.class);
        builder.bindAuto(MenuFactory.class);
        builder.bindAuto(ScreenManager.class);
        builder.bindAuto(LilaFrame.class);
        builder.bindAuto(ShutdownManager.class);
        builder.bindAuto(StatusBannerFactory.class);
        builder.bindFactory(ApplicationLifecycle.class, ctx ->
                new DialogBackedApplicationLifecycle(ctx.get(DialogService.class), ctx.get(ShutdownManager.class)));
    }

    @Override
    public int order() {
        return -50;
    }
}
