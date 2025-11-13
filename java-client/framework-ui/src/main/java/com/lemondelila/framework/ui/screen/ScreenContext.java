package com.lemondelila.framework.ui.screen;

import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.event.DomainEventBus;

public record ScreenContext(ApplicationContext applicationContext,
                            DomainEventBus eventBus,
                            ScreenManager screenManager) {
}

