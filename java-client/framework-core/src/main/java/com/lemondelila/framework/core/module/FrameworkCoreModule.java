package com.lemondelila.framework.core.module;

import com.lemondelila.framework.core.config.ConfigurationService;
import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.event.DomainEventBus;
import com.lemondelila.framework.core.task.TaskScheduler;

public final class FrameworkCoreModule implements LilaModule {

    private TaskScheduler scheduler;

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(DomainEventBus.class);
        builder.bindAuto(TaskScheduler.class);
        builder.bindAuto(ConfigurationService.class);
    }

    @Override
    public void start(ApplicationContext context) {
        scheduler = context.get(TaskScheduler.class);
    }

    @Override
    public void stop(ApplicationContext context) {
        if (scheduler != null) {
            scheduler.close();
        }
    }

    @Override
    public int order() {
        return -100;
    }
}
