package com.lemondelila.client.game.realtime;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.game.realtime.service.RealtimeManager;

@AutoService(LilaModule.class)
public final class RealtimeModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(RealtimeManager.class);
    }

    @Override
    public int order() {
        return 40;
    }
}
