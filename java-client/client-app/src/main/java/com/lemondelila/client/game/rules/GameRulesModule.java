package com.lemondelila.client.game.rules;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.game.rules.controller.GameRulesController;
import com.lemondelila.client.game.rules.service.GameRulesService;
import com.lemondelila.client.game.rules.view.GameRulesPresenter;

@AutoService(LilaModule.class)
public final class GameRulesModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(GameRulesService.class);
        builder.bindAuto(GameRulesController.class);
        builder.bindAuto(GameRulesPresenter.class);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(GameRulesController.class);
    }

    @Override
    public int order() {
        // Après réseau/session, avant les jeux spécifiques.
        return 50;
    }
}
