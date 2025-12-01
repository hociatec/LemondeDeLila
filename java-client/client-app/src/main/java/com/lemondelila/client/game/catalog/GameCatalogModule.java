package com.lemondelila.client.game.catalog;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.game.catalog.controller.GameCatalogController;
import com.lemondelila.client.game.catalog.service.GameCatalogService;
import com.lemondelila.client.game.catalog.view.GameCatalogPresenter;
import com.lemondelila.client.game.catalog.view.GameCatalogView;
import com.lemondelila.client.game.catalog.view.GameCatalogScreen;

@AutoService(LilaModule.class)
public final class GameCatalogModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(GameCatalogService.class);
        builder.bindAuto(GameCatalogController.class);
        builder.bindAuto(GameCatalogPresenter.class);
        builder.bindAuto(GameCatalogView.class);
        builder.bindAuto(GameCatalogScreen.class);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(GameCatalogController.class);
    }

    @Override
    public int order() {
        // Après réseau/session, avant les jeux spécifiques.
        return 55;
    }
}
