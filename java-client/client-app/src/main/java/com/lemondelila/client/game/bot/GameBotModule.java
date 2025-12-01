package com.lemondelila.client.game.bot;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.game.bot.controller.BotController;
import com.lemondelila.client.game.bot.controller.BotGuard;
import com.lemondelila.client.game.bot.service.BotApiService;
import com.lemondelila.client.game.bot.service.BotTableService;
import com.lemondelila.client.game.bot.view.BotPresenter;
import com.lemondelila.client.game.bot.view.BotView;

@AutoService(LilaModule.class)
public final class GameBotModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(BotApiService.class);
        builder.bindAuto(BotTableService.class);
        builder.bindAuto(BotGuard.class);
        builder.bindAuto(BotController.class);
        builder.bindAuto(BotPresenter.class);
        builder.bindAuto(BotView.class);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(BotController.class);
    }

    @Override
    public int order() {
        // Après session et room.
        return 44;
    }
}
