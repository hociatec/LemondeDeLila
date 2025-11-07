package com.lemondelila.client.module;

import com.lemondelila.client.controller.catalogue.CatalogController;
import com.lemondelila.client.controller.chat.ChatController;
import com.lemondelila.client.controller.game.GameCatalogController;
import com.lemondelila.client.controller.presence.PresenceController;
import com.lemondelila.client.controller.settings.OptionsController;
import com.lemondelila.client.controller.user.LoginController;
import com.lemondelila.client.controller.user.RegistrationController;
import com.lemondelila.client.controller.user.UserOperationGuard;
import com.lemondelila.client.events.user.LoginSucceeded;
import com.lemondelila.client.model.game.GameEngineRegistry;
import com.lemondelila.client.gamelogic.missionnemesis.controller.NemesisController;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisEngine;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.service.NemesisRemoteClient;
import com.lemondelila.client.gamelogic.missionnemesis.view.NemesisScreen;
import com.lemondelila.client.model.user.ClientSession;
import com.lemondelila.client.service.catalogue.GameCatalogService;
import com.lemondelila.client.service.catalogue.GameRulesService;
import com.lemondelila.client.service.chat.ChatConnectionFactory;
import com.lemondelila.client.service.game.TokenAwareRealtimeGateway;
import com.lemondelila.client.service.settings.AppSettingsService;
import com.lemondelila.client.view.catalogue.CatalogScreen;
import com.lemondelila.client.view.home.HomeScreen;
import com.lemondelila.client.view.menu.MainMenuScreen;
import com.lemondelila.client.view.presence.PresenceDialogLauncher;
import com.lemondelila.client.view.shortcuts.ApplicationShortcuts;
import com.lemondelila.framework.access.FocusHighlighter;
import com.lemondelila.framework.access.NarrationQueue;
import com.lemondelila.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.framework.core.config.ConfigurationService;
import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.event.DomainEventBus;
import com.lemondelila.framework.core.module.LilaModule;
import com.lemondelila.framework.core.task.TaskScheduler;
import com.lemondelila.framework.network.rest.RestClient;
import com.lemondelila.framework.network.ws.RealtimeGateway;
import com.lemondelila.framework.ui.LilaFrame;
import com.lemondelila.framework.ui.action.ActionManager;
import com.lemondelila.framework.ui.dialog.DialogService;
import com.lemondelila.framework.ui.screen.ScreenManager;
import java.net.URI;

public final class ClientAppModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {

        builder.bind(AppSettingsService.class, AppSettingsService::new);
        builder.bind(ClientSession.class, ClientSession::new);
        builder.bind(UserOperationGuard.class, UserOperationGuard::new);
        builder.bind(NemesisEngine.class, NemesisEngine::new);
        builder.bind(NemesisSessionStore.class, NemesisSessionStore::new);
        builder.bindFactory(ChatConnectionFactory.class, ctx -> new ChatConnectionFactory(
                ctx.get(java.net.http.HttpClient.class),
                ctx.get(com.fasterxml.jackson.databind.ObjectMapper.class),
                ctx.get(com.lemondelila.framework.core.config.ConfigurationService.class),
                ctx.get(ClientSession.class)
        ));

        builder.bindFactory(RealtimeGateway.class, ctx -> {
            ConfigurationService config = ctx.get(ConfigurationService.class);
            URI baseUri = URI.create(config.get("network.ws.url", "ws://127.0.0.1:8081/ws"));
            NemesisSessionStore store = ctx.get(NemesisSessionStore.class);
            return new TokenAwareRealtimeGateway(
                    ctx.get(java.net.http.HttpClient.class),
                    ctx.get(com.fasterxml.jackson.databind.ObjectMapper.class),
                    ctx.get(DomainEventBus.class),
                    baseUri,
                    ctx.get(ClientSession.class),
                    () -> store.current().map(NemesisSession::roomId)
            );
        });
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
                ctx.get(ChatController.class),
                ctx.get(PresenceController.class),
                ctx.get(OptionsController.class),
                ctx.get(CatalogController.class),
                ctx.get(ClientSession.class),
                ctx.get(RealtimeGateway.class)
        ));

        builder.bindFactory(GameCatalogService.class, ctx -> new GameCatalogService(
                ctx.get(RestClient.class),
                ctx.get(TaskScheduler.class),
                ctx.get(ClientSession.class)
        ));

        builder.bindFactory(GameRulesService.class, ctx -> new GameRulesService(
                ctx.get(java.net.http.HttpClient.class),
                ctx.get(com.fasterxml.jackson.databind.ObjectMapper.class),
                ctx.get(TaskScheduler.class),
                ctx.get(com.lemondelila.framework.core.config.ConfigurationService.class),
                ctx.get(ClientSession.class)
        ));

        builder.bindFactory(PresenceDialogLauncher.class, ctx -> new PresenceDialogLauncher(
                ctx.get(ChatConnectionFactory.class),
                ctx.get(DialogService.class)
        ));

        builder.bindFactory(ApplicationShortcuts.class, ctx -> new ApplicationShortcuts(
                ctx.get(ActionManager.class),
                ctx.get(AccessibleShortcutRegistry.class),
                ctx.get(PresenceDialogLauncher.class)
        ));

        builder.bindFactory(GameEngineRegistry.class, ctx -> {
            GameEngineRegistry registry = new GameEngineRegistry();
            registry.register(ctx.get(NemesisEngine.class));
            return registry;
        });

        builder.bindFactory(NemesisRemoteClient.class, ctx -> new NemesisRemoteClient(
                ctx.get(RestClient.class),
                ctx.get(TaskScheduler.class),
                ctx.get(ClientSession.class),
                ctx.get(NemesisEngine.class),
                ctx.get(NemesisSessionStore.class)
        ));

        builder.bindFactory(NemesisController.class, ctx ->
                new NemesisController(
                        ctx.get(NemesisRemoteClient.class),
                        ctx.get(DialogService.class),
                        ctx.get(NemesisSessionStore.class),
                        ctx.get(RealtimeGateway.class)
                )
        );

        builder.bindFactory(NemesisScreen.class, ctx -> new NemesisScreen(
                ctx.get(NemesisController.class),
                ctx.get(NemesisSessionStore.class)
        ));

        builder.bindFactory(GameCatalogController.class, ctx ->
                new GameCatalogController(
                        ctx.get(GameCatalogService.class)
                )
        );

        builder.bindFactory(CatalogScreen.class, ctx -> new CatalogScreen(
                ctx.get(GameCatalogController.class),
                ctx.get(GameRulesService.class),
                ctx.get(DialogService.class),
                ctx.get(NemesisController.class)
        ));

        builder.bindFactory(LoginController.class, ctx ->
                new LoginController(
                        ctx.get(DomainEventBus.class),
                        ctx.get(RestClient.class),
                        ctx.get(TaskScheduler.class),
                        ctx.get(ClientSession.class),
                        ctx.get(UserOperationGuard.class)
                )
        );

        builder.bindFactory(RegistrationController.class, ctx ->
                new RegistrationController(
                        ctx.get(DomainEventBus.class),
                        ctx.get(RestClient.class),
                        ctx.get(TaskScheduler.class),
                        ctx.get(UserOperationGuard.class)
                )
        );

        builder.bindFactory(ChatController.class, ctx ->
                new ChatController(
                        ctx.get(ChatConnectionFactory.class),
                        ctx.get(AppSettingsService.class),
                        ctx.get(DialogService.class),
                        ctx.get(ClientSession.class)
                )
        );

        builder.bindFactory(PresenceController.class, ctx ->
                new PresenceController(
                        ctx.get(PresenceDialogLauncher.class),
                        ctx.get(DialogService.class),
                        ctx.get(ClientSession.class)
                )
        );

        builder.bindFactory(OptionsController.class, ctx ->
                new OptionsController(
                        ctx.get(AppSettingsService.class)
                )
        );

        builder.bindFactory(CatalogController.class, ctx ->
                new CatalogController(
                        ctx.get(ClientSession.class),
                        ctx.get(DialogService.class)
                )
        );
    }

    @Override
    public void start(ApplicationContext context) {
        ScreenManager manager = context.get(ScreenManager.class);
        manager.register(context.get(HomeScreen.class));
        manager.register(context.get(MainMenuScreen.class));
        manager.register(context.get(CatalogScreen.class));
        manager.register(context.get(NemesisScreen.class));
        context.get(LoginController.class);
        context.get(RegistrationController.class);
        context.get(ChatController.class);
        context.get(PresenceController.class);
        context.get(OptionsController.class);
        context.get(CatalogController.class);
        context.get(NemesisController.class);

        DomainEventBus eventBus = context.get(DomainEventBus.class);
        ClientSession session = context.get(ClientSession.class);
        RealtimeGateway realtimeGateway = context.get(RealtimeGateway.class);
        eventBus.subscribe(LoginSucceeded.class, event -> realtimeGateway.connect());
        session.authenticated().ifPresent(ignored -> realtimeGateway.connect());

        ApplicationShortcuts shortcuts = context.get(ApplicationShortcuts.class);
        LilaFrame frame = context.get(LilaFrame.class);
        shortcuts.install(frame);
    }

    @Override
    public void stop(ApplicationContext context) throws Exception {
        context.find(LoginController.class).ifPresent(controller -> {
            try {
                controller.close();
            } catch (Exception ignored) {}
        });
        context.find(RegistrationController.class).ifPresent(controller -> {
            try {
                controller.close();
            } catch (Exception ignored) {}
        });
        context.find(ChatController.class).ifPresent(controller -> {
            try {
                controller.close();
            } catch (Exception ignored) {}
        });
        context.find(RealtimeGateway.class).ifPresent(gateway -> {
            try {
                gateway.close();
            } catch (Exception ignored) {}
        });
    }

    @Override
    public int order() {
        return 100;
    }
}







