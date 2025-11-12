package com.lemondelila.framework.ui.module;

import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.module.LilaModule;
import com.lemondelila.framework.ui.LilaFrame;
import com.lemondelila.framework.ui.action.ActionManager;
import com.lemondelila.framework.ui.dialog.DialogService;
import com.lemondelila.framework.ui.menu.MenuFactory;
import com.lemondelila.framework.ui.screen.ScreenManager;

public final class UiFrameworkModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(ActionManager.class);
        builder.bindAuto(DialogService.class);
        builder.bindAuto(MenuFactory.class);
        builder.bindAuto(ScreenManager.class);
        builder.bindAuto(LilaFrame.class);
    }

    @Override
    public int order() {
        return -50;
    }
}
