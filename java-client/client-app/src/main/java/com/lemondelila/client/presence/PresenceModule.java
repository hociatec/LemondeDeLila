package com.lemondelila.client.presence;

import com.google.auto.service.AutoService;
import com.lemondelila.client.presence.controller.PresenceController;
import com.lemondelila.client.presence.service.PresenceConnectionFactory;
import com.lemondelila.client.presence.service.PresenceRealtimeService;
import com.lemondelila.client.presence.service.PresenceSessionBridge;
import com.lemondelila.client.presence.view.DefaultPresenceListDialogFactory;
import com.lemondelila.client.presence.view.PresenceDialogLauncher;
import com.lemondelila.client.presence.view.PresenceListDialogFactory;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;

@AutoService(LilaModule.class)
public final class PresenceModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(PresenceController.class);
        builder.bindAuto(PresenceConnectionFactory.class);
        builder.bindAuto(PresenceRealtimeService.class);
        builder.bindAuto(PresenceSessionBridge.class);
        builder.bindAuto(DefaultPresenceListDialogFactory.class);
        builder.bindFactory(PresenceListDialogFactory.class, ctx -> ctx.get(DefaultPresenceListDialogFactory.class));
        builder.bindAuto(PresenceDialogLauncher.class);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(PresenceController.class);
        context.get(PresenceDialogLauncher.class);
        context.get(PresenceSessionBridge.class);
    }

    @Override
    public int order() {
        return 40;
    }
}
