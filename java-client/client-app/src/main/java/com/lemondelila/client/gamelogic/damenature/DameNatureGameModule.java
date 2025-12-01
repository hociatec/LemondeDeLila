package com.lemondelila.client.gamelogic.damenature;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureConfigState;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureLaunchHandler;
import com.lemondelila.client.gamelogic.damenature.view.DameNatureInteractionProvider;

@AutoService(LilaModule.class)
public final class DameNatureGameModule implements LilaModule {

    public static final String GAME_TYPE = "dame-nature";

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(DameNatureInteractionProvider.class);
        builder.bindAuto(DameNatureConfigState.class);
        builder.bindAuto(DameNatureLaunchHandler.class);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(DameNatureInteractionProvider.class);
        context.get(DameNatureLaunchHandler.class);
    }

    @Override
    public int order() {
        return 66;
    }
}
