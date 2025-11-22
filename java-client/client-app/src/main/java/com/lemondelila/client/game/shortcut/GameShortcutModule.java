package com.lemondelila.client.game.shortcut;

import com.google.auto.service.AutoService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;

@AutoService(LilaModule.class)
public final class GameShortcutModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(com.lemondelila.client.game.shortcut.controller.TableShortcutManager.class);
        builder.bindAuto(com.lemondelila.client.game.shortcut.controller.ShortcutController.class);
    }

    @Override
    public int order() {
        // Avant les écrans de jeu pour que le manager soit dispo.
        return 40;
    }
}
