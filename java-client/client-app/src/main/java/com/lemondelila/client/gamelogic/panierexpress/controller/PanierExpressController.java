package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSessionStore;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressRemoteClient;
import com.lemondelila.client.game.controller.AbstractGameController;
import com.lemondelila.client.game.controller.GameControllerSupport;
import com.lemondelila.client.game.controller.GameScreenController;
import com.lemondelila.client.game.service.GameRoomBotManager;
import com.lemondelila.client.game.service.RoomBotRemoteClient;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

/**
 * Fa��ade regroupant les fonctionnalit�s Panier Express c�t� client.
 * Le pilotage est d�l�gu� � des composants sp�cialis�s afin de faciliter la maintenance.
 */
public final class PanierExpressController extends AbstractGameController<PanierExpressSession>
        implements GameScreenController<PanierExpressSession> {

    private final PanierExpressRemoteClient remoteClient;
    private final GameRoomBotManager<PanierExpressSession> botManager;
    private volatile PanierExpressGameOptions lastOptions = PanierExpressGameOptions.defaults();

    @Inject
    public PanierExpressController(PanierExpressRemoteClient remoteClient,
                                   PanierExpressSessionStore sessionStore,
                                   DialogService dialogService,
                                   DomainEventBus eventBus,
                                   RoomBotRemoteClient roomBots) {
        super(new GameControllerSupport<>(sessionStore, eventBus, dialogService, "Panier Express"));
        this.remoteClient = Objects.requireNonNull(remoteClient, "remoteClient");
        this.botManager = new GameRoomBotManager<>(
                Objects.requireNonNull(roomBots, "roomBots"),
                support().errors(),
                this::currentSession,
                this::refreshGame,
                GameRoomBotManager.botNamesResolver(
                        session -> {
                            if (session == null || session.state() == null) {
                                return List.of();
                            }
                            return session.state().players();
                        },
                        player -> player.isBot(),
                        player -> player.username()));
    }

    public CompletableFuture<PanierExpressSession> startGame(boolean forceNew) {
        return startGame(forceNew, lastOptions);
    }

    public CompletableFuture<PanierExpressSession> startGame(boolean forceNew,
                                                             PanierExpressGameOptions options) {
        PanierExpressGameOptions resolved = options == null
                ? PanierExpressGameOptions.defaults()
                : options;
        lastOptions = resolved;
        return startOrReuseGame(forceNew,
                () -> remoteClient.startNewGame(resolved),
                "Impossible de démarrer la partie");
    }

    public CompletableFuture<PanierExpressSession> refreshGame() {
        return runWithActiveSession(
                null,
                "Impossible d'actualiser la partie",
                session -> remoteClient.refresh(session.roomId()));
    }

    public CompletableFuture<PanierExpressSession> roll() {
        return runWithActiveSession(
                null,
                "Impossible de lancer le dé",
                session -> remoteClient.roll(session.roomId()));
    }

    public CompletableFuture<PanierExpressSession> answerQuiz(int choice) {
        return runWithActiveSession(
                null,
                "Impossible de répondre au quiz",
                session -> remoteClient.answerQuiz(session.roomId(), choice));
    }

    public CompletableFuture<PanierExpressSession> addBot() {
        return botManager.addBot();
    }

    public CompletableFuture<PanierExpressSession> removeBot() {
        return botManager.removeBot();
    }

    public void reset() {
        resetSessions();
        lastOptions = PanierExpressGameOptions.defaults();
    }

}
