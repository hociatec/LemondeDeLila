package com.lemondelila.client.game.history;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.model.GameHistoryTracker;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.history.view.GameHistoryView;

@AutoService(LilaModule.class)
public final class GameHistoryModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(GameHistoryTracker.class);
        builder.bindAuto(GameHistoryView.class);
        builder.bindAuto(GameHistorySidebar.class);
        builder.bindAuto(GameHistoryController.class);
    }

    @Override
    public int order() {
        return 70;
    }
}
