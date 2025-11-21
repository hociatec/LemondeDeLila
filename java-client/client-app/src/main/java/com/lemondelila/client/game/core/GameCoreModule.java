package com.lemondelila.client.game.core;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;

@AutoService(LilaModule.class)
public final class GameCoreModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(GameTableLauncher.class);
        builder.bindAuto(GameAnnouncer.class);
        builder.bindAuto(GameInteractionRegistry.class);
        builder.bindAuto(com.lemondelila.client.game.core.service.GameActionService.class);
        builder.bindAuto(com.lemondelila.client.game.core.mapper.GenericGameStateMapper.class);
        builder.bindAuto(com.lemondelila.client.game.core.service.GameStateService.class);
    }

    @Override
    public int order() {
        // Avant les modules room/catalog pour que le launcher soit disponible.
        return 35;
    }
}
