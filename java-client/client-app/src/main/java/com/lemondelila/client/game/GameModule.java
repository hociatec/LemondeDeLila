package com.lemondelila.client.game;

import com.lemondelila.client.user.events.UserLoggedOut;
import com.lemondelila.client.gamelogic.damenature.controller.DameNatureController;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureEngine;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSessionStore;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureRemoteClient;
import com.lemondelila.client.gamelogic.damenature.view.DameNatureScreen;
import com.lemondelila.client.gamelogic.missionnemesis.controller.NemesisController;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisEngine;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.gamelogic.missionnemesis.service.NemesisRemoteClient;
import com.lemondelila.client.gamelogic.missionnemesis.view.NemesisScreen;
import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressController;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSessionStore;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressRemoteClient;
import com.lemondelila.client.game.service.RoomBotRemoteClient;
import com.lemondelila.client.gamelogic.panierexpress.view.PanierExpressRootView;
import com.lemondelila.client.game.launcher.DameNatureLauncher;
import com.lemondelila.client.game.launcher.GameLauncherRegistry;
import com.lemondelila.client.game.launcher.NemesisLauncher;
import com.lemondelila.client.game.launcher.PanierExpressLauncher;
import com.lemondelila.client.game.model.GameEngine;
import com.lemondelila.client.game.model.GameEngineRegistry;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.module.LilaModule;

public final class GameModule implements LilaModule {

    private AutoCloseable logoutSubscription;

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(NemesisEngine.class);
        builder.bindAuto(NemesisSessionStore.class);
        builder.bindAuto(DameNatureEngine.class);
        builder.bindAuto(DameNatureSessionStore.class);

        builder.bindAuto(NemesisRemoteClient.class);
        builder.bindAuto(DameNatureRemoteClient.class);
        builder.bindAuto(PanierExpressRemoteClient.class);
        builder.bindAuto(RoomBotRemoteClient.class);
        builder.bindAuto(PanierExpressSessionStore.class);

        builder.bindAuto(NemesisController.class);
        builder.bindAuto(DameNatureController.class);
        builder.bindAuto(PanierExpressController.class);
        builder.bindAuto(PanierExpressLauncher.class);
        builder.bindAuto(DameNatureLauncher.class);
        builder.bindAuto(NemesisLauncher.class);

        builder.bindAuto(NemesisScreen.class);
        builder.bindAuto(DameNatureScreen.class);
        builder.bindAuto(PanierExpressRootView.class);
        builder.bindAuto(GameLauncherRegistry.class);

        builder.bindFactory(GameEngineRegistry.class, ctx -> {
            GameEngineRegistry registry = new GameEngineRegistry();
            registerEngine(ctx, registry, NemesisEngine.class);
            registerEngine(ctx, registry, DameNatureEngine.class);
            return registry;
        });
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(NemesisController.class);
        context.get(DameNatureController.class);
        context.get(PanierExpressController.class);
        DomainEventBus eventBus = context.get(DomainEventBus.class);
        GameLauncherRegistry launcherRegistry = context.get(GameLauncherRegistry.class);
        launcherRegistry.register("panier-express", context.get(PanierExpressLauncher.class));
        launcherRegistry.register("panierexpress", context.get(PanierExpressLauncher.class));
        launcherRegistry.register("dame-nature", context.get(DameNatureLauncher.class));
        launcherRegistry.register("mission-nemesis", context.get(NemesisLauncher.class));
        logoutSubscription = eventBus.subscribe(UserLoggedOut.class, event -> {
            context.get(NemesisController.class).reset();
            context.get(DameNatureController.class).reset();
            context.get(PanierExpressController.class).reset();
        });
    }

    @Override
    public void stop(ApplicationContext context) {
        if (logoutSubscription != null) {
            try {
                logoutSubscription.close();
            } catch (Exception ignored) {
            } finally {
                logoutSubscription = null;
            }
        }
        context.find(NemesisController.class).ifPresent(NemesisController::reset);
        context.find(DameNatureController.class).ifPresent(DameNatureController::reset);
        context.find(PanierExpressController.class).ifPresent(PanierExpressController::reset);
    }

    @Override
    public int order() {
        return 60;
    }

    private static <T extends GameEngine<?, ?, ?>> void registerEngine(ApplicationContext ctx,
                                                                       GameEngineRegistry registry,
                                                                       Class<T> type) {
        registry.register(ctx.get(type));
    }
}
