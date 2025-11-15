package com.lemondelila.client.game.launcher;

import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.gamelogic.panierexpress.view.PanierExpressRootView;

import java.util.concurrent.CompletableFuture;

public final class PanierExpressLauncher implements GameLauncher {

    @Override
    public CompletableFuture<ControllerResult> launch(GameSummary game) {
        return CompletableFuture.completedFuture(
                ControllerResult.navigate(PanierExpressRootView.ID)
                        .withStatus("Ouverture de Panier Express...")
        );
    }
}
