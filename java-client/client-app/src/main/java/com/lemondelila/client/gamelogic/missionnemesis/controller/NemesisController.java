package com.lemondelila.client.gamelogic.missionnemesis.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisStateMapper;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;
import com.lemondelila.client.gamelogic.missionnemesis.service.NemesisRemoteClient;
import com.lemondelila.client.game.model.DialogGameErrorHandler;
import com.lemondelila.client.game.service.RoomBotRemoteClient;
import com.lemondelila.client.game.model.GameSessionTracker;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.network.ws.RealtimeGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.http.WebSocket;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

public final class NemesisController {

    private static final Logger LOGGER = LoggerFactory.getLogger(NemesisController.class);
    private static final String GAME_TYPE = "mission-nemesis";

    private final NemesisRemoteClient remoteClient;
    private final RoomBotRemoteClient roomBots;
    private final GameSessionTracker<NemesisSession> sessions;
    private final DialogGameErrorHandler errorHandler;
    private final RealtimeGateway realtimeGateway;
    private final Map<Consumer<NemesisSession>, AutoCloseable> listenerHandles = new ConcurrentHashMap<>();

    private volatile NemesisSession current;

    @Inject
    public NemesisController(NemesisRemoteClient remoteClient,
                             RoomBotRemoteClient roomBots,
                             NemesisSessionStore sessionStore,
                             RealtimeGateway realtimeGateway,
                             DialogService dialogService,
                             DomainEventBus eventBus) {
        this.remoteClient = Objects.requireNonNull(remoteClient, "remoteClient");
        this.roomBots = Objects.requireNonNull(roomBots, "roomBots");
        this.sessions = new GameSessionTracker<>(sessionStore, eventBus);
        this.errorHandler = new DialogGameErrorHandler(dialogService, "Mission Nemesis");
        this.realtimeGateway = Objects.requireNonNull(realtimeGateway, "realtimeGateway");
        this.current = sessionStore.current().orElse(null);
        this.realtimeGateway.onMessage(this::handleRealtimeMessage);
        if (this.current != null) {
            this.realtimeGateway.connect();
        }
    }

    public CompletableFuture<NemesisSession> startNewGame() {
        CompletableFuture<NemesisSession> future = remoteClient.startNewGame();
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show("Impossible de creer la partie Mission Nemesis", error);
                return;
            }
            if (session != null) {
                updateSession(session);
            }
        });
        return future;
    }

    public CompletableFuture<NemesisSession> refresh() {
        NemesisSession snapshot = current;
        if (snapshot == null) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        CompletableFuture<NemesisSession> future = remoteClient.refresh(snapshot.roomId());
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show("Impossible de recuperer l'etat de la partie", error);
                return;
            }
            if (session != null) {
                updateSession(session);
            }
        });
        return future;
    }

    public CompletableFuture<NemesisSession> placeFleet(List<ShipPlacement> placements) {
        NemesisSession snapshot = current;
        if (snapshot == null) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        CompletableFuture<NemesisSession> future = remoteClient.placeFleet(snapshot.roomId(), placements);
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show("Impossible de positionner la flotte", error);
                return;
            }
            if (session != null) {
                updateSession(session);
            }
        });
        return future;
    }

    public CompletableFuture<NemesisSession> fire(GridCoordinate coordinate) {
        NemesisSession snapshot = current;
        if (snapshot == null) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        CompletableFuture<NemesisSession> future = remoteClient.fire(snapshot.roomId(), coordinate);
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show("Impossible de tirer", error);
                return;
            }
            if (session != null) {
                updateSession(session);
            }
        });
        return future;
    }

    public CompletableFuture<NemesisSession> addBot() {
        NemesisSession snapshot = current;
        if (snapshot == null) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        int roomId = snapshot.roomId();
        return roomBots.addBot(roomId)
                .handle((info, error) -> {
                    if (error != null) {
                        errorHandler.show("Impossible d'ajouter un bot", error);
                        throw propagate(error);
                    }
                    return info;
                })
                .thenCompose(ignore -> refresh());
    }

    public CompletableFuture<NemesisSession> removeBot() {
        NemesisSession snapshot = current;
        if (snapshot == null) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        int roomId = snapshot.roomId();
        return roomBots.listBots(roomId)
                .handle((bots, error) -> {
                    if (error != null) {
                        errorHandler.show("Impossible de récupérer la liste des bots", error);
                        throw propagate(error);
                    }
                    return bots;
                })
                .thenCompose(bots -> {
                    RoomBotRemoteClient.RoomBotInfo target = selectBotToRemove(snapshot, bots);
                    if (target == null) {
                        return failedFuture(new IllegalStateException("Aucun bot présent dans la salle"));
                    }
                    return roomBots.removeBot(roomId, target.id())
                            .handle((ignored, error) -> {
                                if (error != null) {
                                    errorHandler.show("Impossible de retirer le bot", error);
                                    throw propagate(error);
                                }
                                return null;
                            })
                            .thenCompose(ignored -> refresh());
                });
    }

    public void addListener(Consumer<NemesisSession> listener) {
        AutoCloseable handle = sessions.listen(listener);
        listenerHandles.put(listener, handle);
    }

    public void removeListener(Consumer<NemesisSession> listener) {
        AutoCloseable handle = listenerHandles.remove(listener);
        if (handle != null) {
            try {
                handle.close();
            } catch (Exception ignored) {
            }
        }
    }

    public Optional<NemesisSession> currentSession() {
        return Optional.ofNullable(current);
    }

    public void reset() {
        current = null;
        sessions.clearAll();
        realtimeGateway.disconnect(WebSocket.NORMAL_CLOSURE, "reset");
    }

    private void updateSession(NemesisSession session) {
        current = session;
        sessions.save(session);
        realtimeGateway.connect();
    }

    private void handleRealtimeMessage(JsonNode message) {
        if (message == null) {
            return;
        }
        if (!"state-updated".equalsIgnoreCase(message.path("type").asText())) {
            return;
        }
        int roomId = message.path("roomId").asInt(-1);
        if (roomId <= 0 || !isTrackedRoom(roomId)) {
            return;
        }
        JsonNode payload = message.path("payload");
        if (!payload.isObject()) {
            return;
        }
        String gameType = payload.path("score").path("type")
                .asText(payload.path("room").path("gameType").asText(""));
        if (!GAME_TYPE.equalsIgnoreCase(gameType)) {
            return;
        }
        JsonNode gameStateNode = payload.path("gameState");
        if (!gameStateNode.isObject()) {
            return;
        }
        try {
            NemesisState state = NemesisStateMapper.fromJson(gameStateNode);
            NemesisSession session = remoteClient.mapSession(roomId, state);
            updateSession(session);
        } catch (IOException ex) {
            LOGGER.warn("Impossible d'interpreter la mise a jour temps reel Mission Nemesis", ex);
        }
    }

    private boolean isTrackedRoom(int roomId) {
        NemesisSession snapshot = current;
        if (snapshot != null && snapshot.roomId() == roomId) {
            return true;
        }
        return sessions.find(roomId).isPresent();
    }

    private static <T> CompletableFuture<T> failedFuture(Throwable error) {
        CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }

    private RoomBotRemoteClient.RoomBotInfo selectBotToRemove(NemesisSession session,
                                                              java.util.List<RoomBotRemoteClient.RoomBotInfo> bots) {
        if (bots == null || bots.isEmpty()) {
            return null;
        }
        java.util.Set<String> botNames = session.state().players().stream()
                .filter(NemesisState.Player::isBot)
                .map(player -> player.username().toLowerCase())
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        for (RoomBotRemoteClient.RoomBotInfo bot : bots) {
            if (botNames.contains(bot.name().toLowerCase())) {
                return bot;
            }
        }
        return bots.get(bots.size() - 1);
    }

    private static RuntimeException propagate(Throwable error) {
        if (error instanceof RuntimeException runtime) {
            return runtime;
        }
        return new RuntimeException(error);
    }
}
