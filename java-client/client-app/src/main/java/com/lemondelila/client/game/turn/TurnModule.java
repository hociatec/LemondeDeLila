package com.lemondelila.client.game.turn;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.game.turn.controller.TurnController;
import com.lemondelila.client.game.turn.model.TurnState;

@AutoService(LilaModule.class)
public final class TurnModule implements LilaModule {
    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(TurnController.class);
    }
}
