package com.lemondelila.client.module;

import com.lemondelila.client.chat.ChatConnectionFactory;
import com.lemondelila.client.controller.AuthController;
import com.lemondelila.client.session.ClientSession;
import com.lemondelila.client.settings.AppSettingsService;
import com.lemondelila.client.ui.screens.HomeScreen;
import com.lemondelila.client.ui.screens.MainMenuScreen;
import com.lemondelila.framework.access.FocusHighlighter;
import com.lemondelila.framework.access.NarrationQueue;
import com.lemondelila.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.event.DomainEventBus;
import com.lemondelila.framework.core.module.LilaModule;
import com.lemondelila.framework.core.task.TaskScheduler;
import com.lemondelila.framework.network.rest.RestClient;
import com.lemondelila.framework.ui.action.ActionManager;
import com.lemondelila.framework.ui.dialog.DialogService;
import com.lemondelila.framework.ui.screen.ScreenManager;

public final class ClientAppModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {

        builder.bind(AppSettingsService.class, AppSettingsService::new);
        builder.bind(ClientSession.class, ClientSession::new);
        builder.bindFactory(ChatConnectionFactory.class, ctx -> new ChatConnectionFactory(
                ctx.get(java.net.http.HttpClient.class),
                ctx.get(com.fasterxml.jackson.databind.ObjectMapper.class),
                ctx.get(com.lemondelila.framework.core.config.ConfigurationService.class),
                ctx.get(ClientSession.class)
        ));

        builder.bindFactory(HomeScreen.class, ctx -> new HomeScreen(
                ctx.get(DomainEventBus.class),
                ctx.get(ActionManager.class),
                ctx.get(AccessibleShortcutRegistry.class),
                ctx.get(FocusHighlighter.class),
                ctx.get(DialogService.class),
                () -> ctx.get(NarrationQueue.class)
        ));

        builder.bindFactory(MainMenuScreen.class, ctx -> new MainMenuScreen(
                ctx.get(DialogService.class),
                ctx.get(AppSettingsService.class),
                ctx.get(ChatConnectionFactory.class),
                ctx.get(ClientSession.class)
        ));

        builder.bindFactory(AuthController.class, ctx ->
                new AuthController(
                        ctx.get(DomainEventBus.class),
                        ctx.get(RestClient.class),
                        ctx.get(TaskScheduler.class),
                        ctx.get(ClientSession.class)
                )
        );
    }

    @Override
    public void start(ApplicationContext context) {
        ScreenManager manager = context.get(ScreenManager.class);
        manager.register(context.get(HomeScreen.class));
        manager.register(context.get(MainMenuScreen.class));
        context.get(AuthController.class);
    }

    @Override
    public void stop(ApplicationContext context) throws Exception {
        context.find(AuthController.class).ifPresent(controller -> {
            try {
                controller.close();
            } catch (Exception ignored) {}
        });
    }

    @Override
    public int order() {
        return 100;
    }
}

