package com.lemondelila.client.gamelogic.damenature.controller;

import com.lemondelila.client.gamelogic.damenature.model.DameNatureConfig;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSession;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSessionStore;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureRemoteClient;
import com.lemondelila.client.game.model.DialogGameErrorHandler;
import com.lemondelila.client.game.service.RoomBotRemoteClient;
import com.lemondelila.client.game.model.GameSessionTracker;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.ui.dialog.DialogService;

import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

public final class DameNatureController {

    private final GameSessionTracker<DameNatureSession> sessions;
    private final DameNatureGameLauncher gameLauncher;
    private final DameNatureActionController actionController;
    private final RoomBotRemoteClient roomBots;
    private final DialogGameErrorHandler errorHandler;
    private final Map<Consumer<DameNatureSession>, AutoCloseable> listenerHandles = new ConcurrentHashMap<>();

    @Inject
    public DameNatureController(DameNatureRemoteClient remoteClient,
                                DialogService dialogService,
                                DameNatureSessionStore sessionStore,
                                DomainEventBus eventBus,
                                RoomBotRemoteClient roomBots) {
        Objects.requireNonNull(remoteClient, "remoteClient");
        this.sessions = new GameSessionTracker<>(sessionStore, eventBus);
        this.roomBots = Objects.requireNonNull(roomBots, "roomBots");
        this.errorHandler = new DialogGameErrorHandler(dialogService, "Dame Nature");
        this.gameLauncher = new DameNatureGameLauncher(remoteClient, sessions, errorHandler);
        this.actionController = new DameNatureActionController(remoteClient, sessions, errorHandler);
    }

    public CompletableFuture<DameNatureSession> startNewGame() {
        return gameLauncher.startGame();
    }

    public CompletableFuture<DameNatureSession> startNewGame(DameNatureConfig config) {
        return gameLauncher.startGame(Objects.requireNonNull(config, "config"));
    }

    public CompletableFuture<DameNatureSession> refresh() {
        return actionController.refresh();
    }

    public CompletableFuture<DameNatureSession> askCard(int targetId, String familyId, String memberId) {
        return actionController.askCard(targetId, familyId, memberId);
    }

    public CompletableFuture<DameNatureSession> draw() {
        return actionController.draw();
    }

    public CompletableFuture<DameNatureSession> answerQuiz(int choice) {
        return actionController.answerQuiz(choice);
    }

    public CompletableFuture<DameNatureSession> addBot() {
        Optional<DameNatureSession> snapshot = sessions.current();
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
                .thenCompose(ignored -> actionController.refresh());
    }

    public CompletableFuture<DameNatureSession> removeBot() {
        Optional<DameNatureSession> snapshot = sessions.current();
        if (snapshot.isEmpty()) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        DameNatureSession session = snapshot.get();
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
                            .thenCompose(ignored -> actionController.refresh());
                });
    }

    public void addListener(Consumer<DameNatureSession> listener) {
        AutoCloseable handle = sessions.listen(listener);
        listenerHandles.put(listener, handle);
    }

    public void removeListener(Consumer<DameNatureSession> listener) {
        AutoCloseable handle = listenerHandles.remove(listener);
        if (handle != null) {
            try {
                handle.close();
            } catch (Exception ignored) {
            }
        }
    }

    public Optional<DameNatureSession> currentSession() {
        return sessions.current();
    }

    public void reset() {
        sessions.clearAll();
        gameLauncher.reset();
    }

    private RoomBotRemoteClient.RoomBotInfo selectBotToRemove(DameNatureSession session,
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
