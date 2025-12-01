package com.lemondelila.client.game.session;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.game.session.controller.SessionController;
import com.lemondelila.client.game.session.controller.SessionGuard;
import com.lemondelila.client.game.session.model.SessionState;
import com.lemondelila.client.game.session.service.SessionApiService;
import com.lemondelila.client.game.session.view.SessionPresenter;
import com.lemondelila.client.game.session.view.SessionView;

@AutoService(LilaModule.class)
public final class GameSessionModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(SessionState.class);
        builder.bindAuto(SessionApiService.class);
        builder.bindAuto(SessionGuard.class);
        builder.bindAuto(SessionController.class);
        builder.bindAuto(SessionPresenter.class);
        builder.bindAuto(SessionView.class);
    }

    @Override
    public void start(ApplicationContext context) {
        // Warm controller so it subscribes to events immediately.
        context.get(SessionController.class);
    }

    @Override
    public int order() {
        // After user module (20) and network (30), before room logic.
        return 32;
    }
}
