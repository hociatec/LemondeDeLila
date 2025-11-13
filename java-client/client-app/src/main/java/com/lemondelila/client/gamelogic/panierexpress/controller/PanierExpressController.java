package com.lemondelila.client.gamelogic.panierexpress.controller;

import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSessionStore;
import com.lemondelila.client.gamelogic.panierexpress.service.PanierExpressRemoteClient;
import com.lemondelila.client.game.model.DialogGameErrorHandler;
import com.lemondelila.client.game.model.GameSessionTracker;
import com.lemondelila.client.game.service.RoomBotRemoteClient;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.ui.dialog.DialogService;

import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * Façade regroupant les fonctionnalités Panier Express côté client.
 * Le pilotage est délégué à des composants spécialisés afin de faciliter la maintenance.
 */
public final class PanierExpressController {

    private final GameSessionTracker<PanierExpressSession> sessions;
    private final PanierExpressGameLauncher gameLauncher;
    private final PanierExpressTurnController turnController;
    private final RoomBotRemoteClient roomBots;
    private final DialogGameErrorHandler errorHandler;
    private final Map<Consumer<PanierExpressSession>, AutoCloseable> listenerHandles = new ConcurrentHashMap<>();

    @Inject
    public PanierExpressController(PanierExpressRemoteClient remoteClient,
                                   PanierExpressSessionStore sessionStore,
                                   DialogService dialogService,
                                   DomainEventBus eventBus,
                                   RoomBotRemoteClient roomBots) {
        this.sessions = new GameSessionTracker<>(sessionStore, eventBus);
        this.errorHandler = new DialogGameErrorHandler(dialogService, "Panier Express");
        this.roomBots = Objects.requireNonNull(roomBots, "roomBots");
        this.gameLauncher = new PanierExpressGameLauncher(remoteClient, sessions, errorHandler);
        this.turnController = new PanierExpressTurnController(remoteClient, sessions, errorHandler);
    }

    public CompletableFuture<PanierExpressSession> startGame(boolean forceNew) {
        return gameLauncher.startGame(forceNew, gameLauncher.lastOptions());
    }

    public CompletableFuture<PanierExpressSession> startGame(boolean forceNew,
                                                             PanierExpressGameOptions options) {
        return gameLauncher.startGame(forceNew, options);
    }

    public CompletableFuture<PanierExpressSession> refreshGame() {
        return turnController.refreshGame();
    }

    public CompletableFuture<PanierExpressSession> roll() {
        return turnController.roll();
    }

    public CompletableFuture<PanierExpressSession> answerQuiz(int choice) {
        return turnController.answerQuiz(choice);
    }

    public CompletableFuture<PanierExpressSession> addBot() {
        Optional<PanierExpressSession> snapshot = sessions.current();
        if (snapshot.isEmpty()) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        int roomId = snapshot.get().roomId();
        return roomBots.addBot(roomId)
                .handle((info, error) -> {
                    if (error != null) {
                        errorHandler.show("Impossible d'ajouter un bot", error);
                        throw propagate(error);
                    }
                    return info;
                })
                .thenCompose(ignored -> turnController.refreshGame());
    }

    public CompletableFuture<PanierExpressSession> removeBot() {
        Optional<PanierExpressSession> snapshot = sessions.current();
        if (snapshot.isEmpty()) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        PanierExpressSession session = snapshot.get();
        int roomId = session.roomId();
        return roomBots.listBots(roomId)
                .handle((bots, error) -> {
                    if (error != null) {
                        errorHandler.show("Impossible de récupérer la liste des bots", error);
                        throw propagate(error);
                    }
                    return bots;
                })
                .thenCompose(bots -> {
                    RoomBotRemoteClient.RoomBotInfo target = selectBotToRemove(session, bots);
                    if (target == null) {
                        return failedFuture(new IllegalStateException("Aucun bot disponible"));
                    }
                    return roomBots.removeBot(roomId, target.id())
                            .handle((ignored, error) -> {
                                if (error != null) {
                                    errorHandler.show("Impossible de retirer le bot", error);
                                    throw propagate(error);
                                }
                                return null;
                            })
                            .thenCompose(ignored -> turnController.refreshGame());
                });
    }

    public Optional<PanierExpressSession> currentSession() {
        return sessions.current();
    }

    public void addSessionListener(Consumer<PanierExpressSession> listener) {
        AutoCloseable handle = sessions.listen(listener);
        listenerHandles.put(listener, handle);
    }

    public void removeSessionListener(Consumer<PanierExpressSession> listener) {
        AutoCloseable handle = listenerHandles.remove(listener);
        if (handle != null) {
            try {
                handle.close();
            } catch (Exception ignored) {
            }
        }
    }

    public void reset() {
        sessions.clearAll();
        gameLauncher.reset();
    }

    private RoomBotRemoteClient.RoomBotInfo selectBotToRemove(PanierExpressSession session,
                                                              java.util.List<RoomBotRemoteClient.RoomBotInfo> bots) {
        if (bots == null || bots.isEmpty()) {
            return null;
        }
        java.util.Set<String> botNames = session.state().players().stream()
                .filter(player -> player != null && player.isBot())
                .map(player -> player.username().toLowerCase())
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        for (RoomBotRemoteClient.RoomBotInfo bot : bots) {
            if (botNames.contains(bot.name().toLowerCase())) {
                return bot;
            }
        }
        return bots.get(bots.size() - 1);
    }

    private static <T> CompletableFuture<T> failedFuture(Throwable error) {
        CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }

    private static RuntimeException propagate(Throwable error) {
        if (error instanceof RuntimeException runtime) {
            return runtime;
        }
        return new RuntimeException(error);
    }
}
