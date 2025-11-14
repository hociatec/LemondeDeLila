package com.lemondelila.client.gamelogic.missionnemesis.controller;

import com.lemondelila.client.game.model.DialogGameErrorHandler;
import com.lemondelila.client.game.service.RoomBotRemoteClient;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;
import java.util.stream.Collectors;

final class NemesisBotActions {

    private final RoomBotRemoteClient roomBots;
    private final DialogGameErrorHandler errorHandler;
    private final NemesisSessionCoordinator sessionCoordinator;
    private final Supplier<CompletableFuture<NemesisSession>> refresher;

    NemesisBotActions(RoomBotRemoteClient roomBots,
                      DialogGameErrorHandler errorHandler,
                      NemesisSessionCoordinator sessionCoordinator,
                      Supplier<CompletableFuture<NemesisSession>> refresher) {
        this.roomBots = roomBots;
        this.errorHandler = errorHandler;
        this.sessionCoordinator = sessionCoordinator;
        this.refresher = refresher;
    }

    CompletableFuture<NemesisSession> addBot() {
        NemesisSession snapshot = sessionCoordinator.snapshot();
        if (snapshot == null) {
            return NemesisController.failedFuture(new IllegalStateException("Aucune partie active"));
        }
        int roomId = snapshot.roomId();
        return roomBots.addBot(roomId)
                .handle((info, error) -> {
                    if (error != null) {
                        errorHandler.show("Impossible d'ajouter un bot", error);
                        throw NemesisController.propagate(error);
                    }
                    return info;
                })
                .thenCompose(ignore -> refresher.get());
    }

    CompletableFuture<NemesisSession> removeBot() {
        NemesisSession snapshot = sessionCoordinator.snapshot();
        if (snapshot == null) {
            return NemesisController.failedFuture(new IllegalStateException("Aucune partie active"));
        }
        int roomId = snapshot.roomId();
        return roomBots.listBots(roomId)
                .handle((bots, error) -> {
                    if (error != null) {
                        errorHandler.show("Impossible de récupérer la liste des bots", error);
                        throw NemesisController.propagate(error);
                    }
                    return bots;
                })
                .thenCompose(bots -> {
                    RoomBotRemoteClient.RoomBotInfo target = selectBotToRemove(snapshot, bots);
                    if (target == null) {
                        return NemesisController.failedFuture(new IllegalStateException("Aucun bot présent dans la salle"));
                    }
                    return roomBots.removeBot(roomId, target.id())
                            .handle((ignored, error) -> {
                                if (error != null) {
                                    errorHandler.show("Impossible de retirer le bot", error);
                                    throw NemesisController.propagate(error);
                                }
                                return null;
                            })
                            .thenCompose(ignored -> refresher.get());
                });
    }

    private RoomBotRemoteClient.RoomBotInfo selectBotToRemove(NemesisSession session,
                                                              List<RoomBotRemoteClient.RoomBotInfo> bots) {
        if (bots == null || bots.isEmpty()) {
            return null;
        }
        Set<String> botNames = session.state().players().stream()
                .filter(NemesisState.Player::isBot)
                .map(player -> player.username().toLowerCase())
                .collect(Collectors.toCollection(LinkedHashSet::new));
        for (RoomBotRemoteClient.RoomBotInfo bot : bots) {
            if (botNames.contains(bot.name().toLowerCase())) {
                return bot;
            }
        }
        return bots.get(bots.size() - 1);
    }
}
