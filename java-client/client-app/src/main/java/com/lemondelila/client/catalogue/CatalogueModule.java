package com.lemondelila.client.catalogue;

import com.lemondelila.client.catalogue.controller.CatalogController;
import com.lemondelila.client.game.controller.GameCatalogController;
import com.lemondelila.client.catalogue.service.GameCatalogService;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.catalogue.view.CatalogScreen;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;

public final class CatalogueModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(GameCatalogService.class);
        builder.bindAuto(GameRulesService.class);
        builder.bindAuto(GameCatalogController.class);
        builder.bindAuto(CatalogController.class);
        builder.bindAuto(CatalogScreen.class);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(GameCatalogController.class);
        context.get(CatalogController.class);
    }

    @Override
    public int order() {
        return 50;
    }
}
