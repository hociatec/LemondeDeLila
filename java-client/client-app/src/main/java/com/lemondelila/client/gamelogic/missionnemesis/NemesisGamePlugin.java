package com.lemondelila.client.gamelogic.missionnemesis;

import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.game.launcher.GameLauncherBinding;
import com.lemondelila.client.game.plugin.GamePlugin;
import com.lemondelila.client.gamelogic.missionnemesis.controller.NemesisController;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisEngine;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.gamelogic.missionnemesis.service.NemesisRemoteClient;
import com.lemondelila.client.gamelogic.missionnemesis.view.NemesisScreen;
import com.lemondelila.client.game.model.GameEngineRegistry;

import java.util.stream.Stream;

/**
 * Plugin pour Mission Nemesis.
 */
public final class NemesisGamePlugin implements GamePlugin {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(NemesisEngine.class);
        builder.bindAuto(NemesisSessionStore.class);
        builder.bindAuto(NemesisRemoteClient.class);
        builder.bindAuto(NemesisController.class);
        builder.bindAuto(NemesisScreen.class);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(NemesisController.class);
    }

    @Override
    public Stream<GameLauncherBinding> launchers(ApplicationContext context) {
        NemesisController controller = context.get(NemesisController.class);
        return Stream.of(GameLauncherBinding.of(game -> {
            String name = (game == null || game.name() == null || game.name().isBlank())
                    ? "Mission Nemesis"
                    : game.name();
            return controller.startNewGame()
                    .thenApply(session -> ControllerResult.navigate(NemesisScreen.ID)
                            .withStatus("Partie " + name + " lancee."));
        }, "mission-nemesis", "nemesis"));
    }

    @Override
    public void registerEngines(ApplicationContext context, GameEngineRegistry registry) {
        registry.register(context.get(NemesisEngine.class));
    }

    @Override
    public void onUserLoggedOut(ApplicationContext context) {
        context.find(NemesisController.class).ifPresent(NemesisController::reset);
    }
}
