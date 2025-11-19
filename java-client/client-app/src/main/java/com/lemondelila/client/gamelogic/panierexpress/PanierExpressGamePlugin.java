package com.lemondelila.client.gamelogic.panierexpress;

import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.component.NarrationPanel;
import com.lemondelila.client.game.launcher.GameLauncherBinding;
import com.lemondelila.client.game.plugin.GamePlugin;
import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressController;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressRemoteClient;
import com.lemondelila.client.gamelogic.panierexpress.view.PanierExpressGamePanel;
import com.lemondelila.client.gamelogic.panierexpress.view.PanierExpressRootView;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSessionStore;
import com.lemondelila.client.application.Internationalization;


import java.util.concurrent.CompletableFuture;
import java.util.stream.Stream;

/**
 * Plugin Panier Express – enregistre les dépendances DI et son launcher.
 */
public final class PanierExpressGamePlugin implements GamePlugin {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindAuto(PanierExpressRemoteClient.class);
        builder.bindAuto(PanierExpressSessionStore.class);
        builder.bindAuto(PanierExpressController.class);
        builder.bindAuto(PanierExpressRootView.class);
        builder.bindFactory(PanierExpressGamePanel.class, ctx -> new PanierExpressGamePanel());
        builder.bindFactory(NarrationPanel.class, ctx -> new NarrationPanel(
                Internationalization.text("panierexpress.screenreader.name"),
                Internationalization.text("panierexpress.screenreader.desc")
        ));
    }

    @Override
    public void start(ApplicationContext context) {
        context.get(PanierExpressController.class);
    }

    @Override
    public Stream<GameLauncherBinding> launchers(ApplicationContext context) {
        return Stream.of(GameLauncherBinding.of(game -> CompletableFuture.completedFuture(
                ControllerResult.navigate(PanierExpressRootView.ID)
                        .withStatus("Ouverture de Panier Express...")),
                "panier-express", "panierexpress"));
    }

    @Override
    public void onUserLoggedOut(ApplicationContext context) {
        context.find(PanierExpressController.class).ifPresent(PanierExpressController::reset);
    }
}
