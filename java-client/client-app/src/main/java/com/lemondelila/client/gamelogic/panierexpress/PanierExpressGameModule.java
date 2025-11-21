package com.lemondelila.client.gamelogic.panierexpress;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressTableController;
import com.lemondelila.client.gamelogic.panierexpress.view.PanierExpressInteractionProvider;

@AutoService(LilaModule.class)
public final class PanierExpressGameModule implements LilaModule {

    public static final String GAME_TYPE = "panier-express";

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(PanierExpressTableController.class);
        builder.bindAuto(PanierExpressInteractionProvider.class);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(PanierExpressTableController.class);
    }

    @Override
    public int order() {
        // Après les modules session/room/bot.
        return 65;
    }
}
