package com.lemondelila.client.menu;

import com.google.auto.service.AutoService;
import com.lemondelila.client.menu.controller.MainMenuAudio;
import com.lemondelila.client.menu.controller.MainMenuPresenter;
import com.lemondelila.client.menu.view.MainMenuView;
import com.lemondelila.client.chat.controller.ChatController;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.ui.component.StatusBannerFactory;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.game.catalog.controller.GameCatalogController;
import com.lemondelila.client.presence.controller.PresenceController;
import com.lemondelila.client.settings.controller.OptionsController;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.admin.controller.AdminController;

@AutoService(LilaModule.class)
public final class MainMenuModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindFactory(MainMenuView.class, ctx -> new MainMenuView(ctx.get(StatusBannerFactory.class)));
        builder.bindFactory(MainMenuAudio.class, ctx -> new MainMenuAudio(ctx.get(SoundEffectManager.class)));
        builder.bindFactory(MainMenuPresenter.class, ctx -> new MainMenuPresenter(
                ctx.get(DialogService.class),
                ctx.get(ChatController.class),
                ctx.get(PresenceController.class),
                ctx.get(OptionsController.class),
                ctx.get(GameCatalogController.class),
                ctx.get(AdminController.class),
                ctx.get(ClientSession.class),
                ctx.get(DomainEventBus.class),
                ctx.get(MainMenuAudio.class),
                ctx.get(MainMenuView.class)
        ));
    }

    @Override
    public int order() {
        return 60;
    }
}
