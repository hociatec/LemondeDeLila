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
import com.lemondelila.client.gamelogic.damenature.controller.DameNatureController;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureEngine;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSessionStore;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureRemoteClient;
import com.lemondelila.client.gamelogic.damenature.service.LocalDameNatureService;
import com.lemondelila.client.gamelogic.damenature.view.DameNatureScreen;
import com.lemondelila.client.model.game.GameEngineRegistry;
import com.lemondelila.client.gamelogic.missionnemesis.controller.NemesisController;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisEngine;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.gamelogic.missionnemesis.service.NemesisRemoteClient;
import com.lemondelila.client.gamelogic.missionnemesis.view.NemesisScreen;
import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressController;
import com.lemondelila.client.media.SoundBank;
import com.lemondelila.client.model.settings.AppSettings;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSessionStore;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressRemoteClient;
import com.lemondelila.client.gamelogic.panierexpress.view.PanierExpressRootView;
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
import com.lemondelila.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.framework.core.context.ApplicationContext;
import com.lemondelila.framework.core.event.DomainEventBus;
import com.lemondelila.framework.core.module.LilaModule;
import com.lemondelila.framework.core.task.TaskScheduler;
import com.lemondelila.framework.media.audio.AudioService;
import com.lemondelila.framework.media.sound.SoundEffectManager;
import com.lemondelila.framework.media.sound.SoundPreferences;
import com.lemondelila.framework.network.ws.RealtimeGateway;
import com.lemondelila.framework.ui.LilaFrame;
import com.lemondelila.framework.ui.action.ActionManager;
import com.lemondelila.framework.ui.dialog.DialogService;
import com.lemondelila.framework.ui.screen.ScreenManager;
import java.util.List;

public final class ClientAppModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {

        builder.bindAuto(AppSettingsService.class);
        builder.bindAuto(ClientSession.class);
        builder.bindAuto(UserOperationGuard.class);
        builder.bindAuto(NemesisEngine.class);
        builder.bindAuto(NemesisSessionStore.class);
        builder.bindAuto(DameNatureEngine.class);
        builder.bindAuto(DameNatureSessionStore.class);
        builder.bindAuto(ChatConnectionFactory.class);

        builder.bindAuto(AudioService.class);

        builder.bindFactory(SoundEffectManager.class, ctx -> {
            SoundEffectManager manager = new SoundEffectManager(ctx.get(AudioService.class));
            manager.registerClips(List.of(SoundBank.values()));
            AppSettingsService settings = ctx.get(AppSettingsService.class);
            manager.applyPreferences(new SettingsSoundPreferences(settings.current()));
            settings.listen(prefs -> manager.applyPreferences(new SettingsSoundPreferences(prefs)));
            return manager;
        });

        builder.bind(RealtimeGateway.class, TokenAwareRealtimeGateway.class);
        builder.bindAuto(HomeScreen.class);
        builder.bindAuto(MainMenuScreen.class);

        builder.bindAuto(GameCatalogService.class);
        builder.bindAuto(GameRulesService.class);
        builder.bindAuto(PresenceDialogLauncher.class);
        builder.bindAuto(ApplicationShortcuts.class);

        builder.bindFactory(GameEngineRegistry.class, ctx -> {
            GameEngineRegistry registry = new GameEngineRegistry();
            registry.register(ctx.get(NemesisEngine.class));
            registry.register(ctx.get(DameNatureEngine.class));
            return registry;
        });

        builder.bindAuto(NemesisRemoteClient.class);
        builder.bindAuto(LocalDameNatureService.class);
        builder.bindAuto(DameNatureRemoteClient.class);

        builder.bindAuto(PanierExpressSessionStore.class);

        builder.bindAuto(PanierExpressRemoteClient.class);
        builder.bindAuto(NemesisController.class);
        builder.bindAuto(DameNatureController.class);

        builder.bindAuto(PanierExpressController.class);

        builder.bindAuto(NemesisScreen.class);
        builder.bindAuto(DameNatureScreen.class);
        builder.bindAuto(PanierExpressRootView.class);

        builder.bindAuto(GameCatalogController.class);
        builder.bindAuto(CatalogScreen.class);
        builder.bindAuto(LoginController.class);
        builder.bindAuto(RegistrationController.class);
        builder.bindAuto(ChatController.class);
        builder.bindAuto(PresenceController.class);
        builder.bindAuto(OptionsController.class);
        builder.bindAuto(CatalogController.class);
    }

    @Override
    public void start(ApplicationContext context) {
        ScreenManager manager = context.get(ScreenManager.class);
        manager.register(context.get(HomeScreen.class));
        manager.register(context.get(MainMenuScreen.class));
        manager.register(context.get(CatalogScreen.class));
        manager.register(context.get(PanierExpressRootView.class));
        manager.register(context.get(NemesisScreen.class));
        manager.register(context.get(DameNatureScreen.class));
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
        context.find(SoundEffectManager.class).ifPresent(SoundEffectManager::stopAllLooping);
        context.find(AudioService.class).ifPresent(service -> {
            try {
                service.close();
            } catch (Exception ignored) {
            }
        });
    }

    private record SettingsSoundPreferences(AppSettings settings) implements SoundPreferences {
        @Override
        public boolean isEnabled(String clipKey) {
            if (!settings.soundEnabled()) {
                return false;
            }
            return switch (clipKey) {
                case "sound.app.launch" -> settings.soundAppLaunch() && settings.soundAppLaunchVolume() > 0;
                case "sound.background.fon" -> settings.soundBackground() && settings.soundBackgroundVolume() > 0;
                case "sound.menu.navigate" -> settings.soundNavigate() && settings.soundNavigateVolume() > 0;
                case "sound.menu.select" -> settings.soundSelect() && settings.soundSelectVolume() > 0;
                default -> true;
            };
        }

        @Override
        public int volumeFor(String clipKey) {
            if (!settings.soundEnabled()) {
                return 0;
            }
            return switch (clipKey) {
                case "sound.app.launch" -> resolve(settings.soundAppLaunch(), settings.soundAppLaunchVolume());
                case "sound.background.fon" -> resolve(settings.soundBackground(), settings.soundBackgroundVolume());
                case "sound.menu.navigate" -> resolve(settings.soundNavigate(), settings.soundNavigateVolume());
                case "sound.menu.select" -> resolve(settings.soundSelect(), settings.soundSelectVolume());
                default -> 100;
            };
        }

        private int resolve(boolean enabled, int volume) {
            if (!enabled) {
                return 0;
            }
            return Math.max(0, Math.min(100, volume));
        }
    }

    @Override
    public int order() {
        return 100;
    }
}







