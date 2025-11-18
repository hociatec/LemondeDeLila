package com.lemondelila.client.game;

import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.game.launcher.GameLauncherRegistry;
import com.lemondelila.client.game.model.GameEngineRegistry;
import com.lemondelila.client.game.plugin.GamePlugin;
import com.lemondelila.client.game.service.RoomBotRemoteClient;
import com.lemondelila.client.user.events.UserLoggedOut;

import java.util.List;
import java.util.ServiceLoader;

public final class GameModule implements LilaModule {

    private final EventSubscriptions subscriptions = new EventSubscriptions();
    private final List<GamePlugin> plugins;

    public GameModule() {
        this.plugins = ServiceLoader.load(GamePlugin.class)
                .stream()
                .map(ServiceLoader.Provider::get)
                .toList();
    }

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(GameLauncherRegistry.class);
        builder.bindAuto(RoomBotRemoteClient.class);
        builder.bindFactory(GameEngineRegistry.class, ctx -> {
            GameEngineRegistry registry = new GameEngineRegistry();
            plugins.forEach(plugin -> plugin.registerEngines(ctx, registry));
            return registry;
        });
        plugins.forEach(plugin -> plugin.configure(builder));
    }

    @Override
    public void start(ApplicationContext context) throws Exception {
        GameLauncherRegistry launcherRegistry = context.get(GameLauncherRegistry.class);
        for (GamePlugin plugin : plugins) {
            plugin.start(context);
            plugin.registerLaunchers(context, launcherRegistry);
        }
        DomainEventBus eventBus = context.get(DomainEventBus.class);
        subscriptions.add(eventBus.subscribe(UserLoggedOut.class,
                event -> plugins.forEach(plugin -> plugin.onUserLoggedOut(context))));
    }

    @Override
    public void stop(ApplicationContext context) throws Exception {
        subscriptions.close();
        for (GamePlugin plugin : plugins) {
            plugin.stop(context);
        }
    }

    @Override
    public int order() {
        return 60;
    }
}
