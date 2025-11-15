package com.lemondelila.client.application;

import com.lemondelila.client.application.view.home.HomeScreen;
import com.lemondelila.client.application.view.menu.MainMenuScreen;
import com.lemondelila.client.application.view.shortcuts.ApplicationShortcuts;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.ui.LilaFrame;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenManager;

public final class ScreenModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(HomeScreen.class);
        builder.bindAuto(MainMenuScreen.class);
        builder.bindAuto(ApplicationShortcuts.class);
    }

    @Override
    public void start(ApplicationContext context) {
        ScreenManager manager = context.get(ScreenManager.class);
        context.getAll(Screen.class)
                .forEach(manager::register);

        ApplicationShortcuts shortcuts = context.get(ApplicationShortcuts.class);
        LilaFrame frame = context.get(LilaFrame.class);
        shortcuts.install(frame);
    }

    @Override
    public int order() {
        return 80;
    }
}
