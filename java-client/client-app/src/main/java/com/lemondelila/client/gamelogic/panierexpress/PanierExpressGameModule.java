package com.lemondelila.client.gamelogic.panierexpress;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressTableController;

@AutoService(LilaModule.class)
public final class PanierExpressGameModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(PanierExpressTableController.class);
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
