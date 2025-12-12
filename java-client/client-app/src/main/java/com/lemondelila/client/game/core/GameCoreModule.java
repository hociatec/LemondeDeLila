package com.lemondelila.client.game.core;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.game.core.service.GameInteractionRegistry;

@AutoService(LilaModule.class)
public final class GameCoreModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(GameInteractionRegistry.class);
        builder.bindAuto(com.lemondelila.client.game.core.service.GenericGameStateMapper.class);
        builder.bindAuto(com.lemondelila.client.game.core.service.GameRealtimeClient.class);
        builder.bindAuto(com.lemondelila.client.game.core.controller.GenericUniversalInteractionProvider.class);
        java.nio.file.Path logPath = java.nio.file.Path.of(System.getProperty("user.dir")).resolve("logsse.txt");
        builder.bindInstance(com.lemondelila.client.game.core.service.SseLogger.class, new com.lemondelila.client.game.core.service.SseLogger(logPath));
    }

    @Override
    public int order() {
        // Avant les modules room/catalog pour que le launcher soit disponible.
        return 35;
    }
}
