package com.lemondelila.client.framework.ui.screen;

import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.event.DomainEventBus;

public record ScreenContext(ApplicationContext applicationContext,
                            DomainEventBus eventBus,
                            ScreenManager screenManager) {
}

