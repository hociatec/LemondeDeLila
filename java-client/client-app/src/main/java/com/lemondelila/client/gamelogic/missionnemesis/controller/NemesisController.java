package com.lemondelila.client.gamelogic.missionnemesis.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisStateMapper;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;
import com.lemondelila.client.gamelogic.missionnemesis.service.NemesisRemoteClient;
import com.lemondelila.framework.network.ws.RealtimeGateway;
import com.lemondelila.framework.ui.dialog.DialogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.swing.SwingUtilities;
import java.io.IOException;
import java.net.http.WebSocket;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

public final class NemesisController {

    private static final Logger LOGGER = LoggerFactory.getLogger(NemesisController.class);

    private final NemesisRemoteClient remoteClient;
    private final DialogService dialogService;
    private final NemesisSessionStore sessionStore;
    private final RealtimeGateway realtimeGateway;
    private final CopyOnWriteArrayList<Consumer<NemesisSession>> listeners = new CopyOnWriteArrayList<>();
    private volatile NemesisSession current;

    public NemesisController(NemesisRemoteClient remoteClient,
                                    DialogService dialogService,
                                    NemesisSessionStore sessionStore,
                                    RealtimeGateway realtimeGateway) {
        this.remoteClient = Objects.requireNonNull(remoteClient, "remoteClient");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.sessionStore = Objects.requireNonNull(sessionStore, "sessionStore");
        this.realtimeGateway = Objects.requireNonNull(realtimeGateway, "realtimeGateway");
        this.current = sessionStore.current().orElse(null);
        this.realtimeGateway.onMessage(this::handleRealtimeMessage);
        if (this.current != null) {
            this.realtimeGateway.connect();
        }
    }

    public CompletableFuture<NemesisSession> startNewGame() {
        return remoteClient.startNewGame()
                .whenComplete((session, error) -> {
                    if (error != null) {
                        handleError("Impossible de creer la partie Mission Nemesis", error);
                    } else {
                        updateSession(session);
                    }
                });
    }

    public CompletableFuture<NemesisSession> refresh() {
        NemesisSession session = current;
        if (session == null) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        return remoteClient.refresh(session.roomId())
                .whenComplete((updated, error) -> {
                    if (error != null) {
                        handleError("Impossible de recuperer l'etat de la partie", error);
                    } else {
                        updateSession(updated);
                    }
                });
    }

    public CompletableFuture<NemesisSession> placeFleet(List<ShipPlacement> placements) {
        NemesisSession session = current;
        if (session == null) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        return remoteClient.placeFleet(session.roomId(), placements)
                .whenComplete((updated, error) -> {
                    if (error != null) {
                        handleError("Impossible de positionner la flotte", error);
                    } else {
                        updateSession(updated);
                    }
                });
    }

    public CompletableFuture<NemesisSession> fire(GridCoordinate coordinate) {
        NemesisSession session = current;
        if (session == null) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        return remoteClient.fire(session.roomId(), coordinate)
                .whenComplete((updated, error) -> {
                    if (error != null) {
                        handleError("Impossible de tirer", error);
                    } else {
                        updateSession(updated);
                    }
                });
    }

    public void addListener(Consumer<NemesisSession> listener) {
        listeners.add(listener);
        NemesisSession snapshot = current;
        if (snapshot != null) {
            SwingUtilities.invokeLater(() -> listener.accept(snapshot));
        }
    }

    public void removeListener(Consumer<NemesisSession> listener) {
        listeners.remove(listener);
    }

    public Optional<NemesisSession> currentSession() {
        return Optional.ofNullable(current);
    }

    public void reset() {
        current = null;
        sessionStore.clearAll();
        realtimeGateway.disconnect(WebSocket.NORMAL_CLOSURE, "reset");
    }

    private void updateSession(NemesisSession session) {
        current = session;
        sessionStore.save(session);
        realtimeGateway.connect();
        listeners.forEach(listener ->
                SwingUtilities.invokeLater(() -> listener.accept(session))
        );
    }

    private void handleError(String context, Throwable error) {
        Throwable root = unwrap(error);
        String message = root.getMessage() != null ? root.getMessage() : root.toString();
        if (message.contains("java.lang.Integer")) {
            message = "Reponse invalide du serveur.";
        } else if (message.contains("HTTP")) {
            message = message.replace("HTTP", "Reponse HTTP");
        }
        final String dialogMessage = message;
        SwingUtilities.invokeLater(() ->
                dialogService.error("Mission Nemesis", context + " : " + dialogMessage)
        );
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
        if (!"mission-nemesis".equalsIgnoreCase(gameType)) {
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
        return sessionStore.find(roomId).isPresent();
    }

    private static Throwable unwrap(Throwable error) {
        Throwable cause = error;
        while (cause instanceof java.util.concurrent.CompletionException || cause instanceof java.util.concurrent.ExecutionException) {
            if (cause.getCause() == null) {
                break;
            }
            cause = cause.getCause();
        }
        return cause;
    }

    private static <T> CompletableFuture<T> failedFuture(Throwable error) {
        CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }
}


