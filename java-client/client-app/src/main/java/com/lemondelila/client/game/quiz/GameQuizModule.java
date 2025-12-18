package com.lemondelila.client.game.quiz;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.game.quiz.service.DefaultGameQuizComponentFactory;
import com.lemondelila.client.game.quiz.view.GameQuizComponentFactory;

@AutoService(LilaModule.class)
public final class GameQuizModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bind(GameQuizComponentFactory.class, DefaultGameQuizComponentFactory.class);
    }

    @Override
    public int order() {
        // Après l'historique (70) pour que la narration/extraction soit disponible.
        return 75;
    }
}
