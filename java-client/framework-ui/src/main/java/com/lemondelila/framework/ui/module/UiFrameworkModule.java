package com.lemondelila.framework.ui.module;

import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.event.DomainEventBus;
import com.lemondelila.framework.core.module.LilaModule;
import com.lemondelila.framework.core.task.TaskScheduler;
import com.lemondelila.framework.ui.LilaFrame;
import com.lemondelila.framework.ui.action.ActionManager;
import com.lemondelila.framework.ui.dialog.DialogService;
import com.lemondelila.framework.ui.menu.MenuFactory;
import com.lemondelila.framework.ui.screen.ScreenManager;

public final class UiFrameworkModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bind(ActionManager.class, ActionManager::new);
        builder.bind(DialogService.class, DialogService::new);
        builder.bind(MenuFactory.class, MenuFactory::new);
        builder.bindFactory(ScreenManager.class, ctx -> new ScreenManager(
                ctx,
                ctx.get(DomainEventBus.class),
                ctx.get(TaskScheduler.class)
        ));
        builder.bindFactory(LilaFrame.class, ctx -> {
            ScreenManager manager = ctx.get(ScreenManager.class);
            LilaFrame frame = new LilaFrame(manager);
            ctx.get(DialogService.class).attach(frame);
            return frame;
        });
    }

    @Override
    public int order() {
        return -50;
    }
}

