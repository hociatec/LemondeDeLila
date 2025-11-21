package com.lemondelila.client.game.core;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;

@AutoService(LilaModule.class)
public final class GameCoreModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(GameTableLauncher.class);
    }

    @Override
    public int order() {
        // Avant les modules room/catalog pour que le launcher soit disponible.
        return 35;
    }
}
