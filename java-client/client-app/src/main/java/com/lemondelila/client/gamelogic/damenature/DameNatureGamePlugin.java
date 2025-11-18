package com.lemondelila.client.gamelogic.damenature;

import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.game.launcher.GameLauncherBinding;
import com.lemondelila.client.game.plugin.GamePlugin;
import com.lemondelila.client.gamelogic.damenature.controller.DameNatureController;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureEngine;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSessionStore;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureRemoteClient;
import com.lemondelila.client.gamelogic.damenature.view.DameNatureScreen;
import com.lemondelila.client.game.model.GameEngineRegistry;

import java.util.stream.Stream;

/**
 * Plugin pour le jeu Dame Nature.
 */
public final class DameNatureGamePlugin implements GamePlugin {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(DameNatureEngine.class);
        builder.bindAuto(DameNatureSessionStore.class);
        builder.bindAuto(DameNatureRemoteClient.class);
        builder.bindAuto(DameNatureController.class);
        builder.bindAuto(DameNatureScreen.class);
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(DameNatureController.class);
    }

    @Override
    public Stream<GameLauncherBinding> launchers(ApplicationContext context) {
        DameNatureController controller = context.get(DameNatureController.class);
        return Stream.of(GameLauncherBinding.of(game -> {
            String name = (game == null || game.name() == null || game.name().isBlank())
                    ? "Dame Nature"
                    : game.name();
            return controller.startNewGame()
                    .thenApply(session -> ControllerResult.navigate(DameNatureScreen.ID)
                            .withStatus("Partie " + name + " lancee."));
        }, "dame-nature", "damenature"));
    }

    @Override
    public void registerEngines(ApplicationContext context, GameEngineRegistry registry) {
        registry.register(context.get(DameNatureEngine.class));
    }

    @Override
    public void onUserLoggedOut(ApplicationContext context) {
        context.find(DameNatureController.class).ifPresent(DameNatureController::reset);
    }
}
