package com.lemondelila.client.game.room.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.game.bot.event.BotAdded;
import com.lemondelila.client.game.bot.event.BotOperationFailed;
import com.lemondelila.client.game.bot.event.BotRemoved;
import com.lemondelila.client.game.bot.service.BotTableService;
import com.lemondelila.client.game.bot.service.BotTableService.BotActionResult;
import com.lemondelila.client.game.history.service.GameAnnouncer;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.history.service.RoomNarrationService;
import com.lemondelila.client.game.room.event.RoomOperationFailed;
import com.lemondelila.client.game.room.event.RoomPrivacyChanged;
import com.lemondelila.client.game.room.event.RoomUpdated;
import com.lemondelila.client.game.room.event.StartRoomRequested;
import com.lemondelila.client.game.room.model.RoomDetailsState;
import com.lemondelila.client.game.room.model.RoomState;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.room.service.RoomLifecycleService;
import com.lemondelila.client.game.room.service.RoomRealtimeService;
import com.lemondelila.client.game.turn.controller.TurnController;
import com.lemondelila.client.game.turn.model.TurnState;

import java.util.Objects;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Centralise la logique metier et les annonces liees aux interactions sur une table.
 */
public final class RoomTableController {

    private final RoomDetailsState detailsState;
    private final TableState tableState;
    private final DomainEventBus eventBus;
    private final GameAnnouncer announcer;
    private final GameHistorySidebar historySidebar;
    private final RoomLifecycleService lifecycleService;
    private final RoomRealtimeService realtimeService;
    private final BotTableService botTableService;
    private final TurnController turnController;
    private final RoomNarrationService narration;

    @Inject
    public RoomTableController(RoomDetailsState detailsState,
                               TableState tableState,
                               DomainEventBus eventBus,
                               GameAnnouncer announcer,
                               GameHistorySidebar historySidebar,
                               RoomLifecycleService lifecycleService,
                               RoomRealtimeService realtimeService,
                               BotTableService botTableService,
                               TurnController turnController,
                               RoomNarrationService narration) {
        this.detailsState = detailsState;
        this.tableState = tableState;
        this.eventBus = eventBus;
        this.announcer = announcer;
        this.historySidebar = historySidebar;
        this.lifecycleService = lifecycleService;
        this.realtimeService = realtimeService;
        this.botTableService = botTableService;
        this.turnController = turnController;
        this.narration = narration;
    }

    public void addBot() {
        BotActionResult result = botTableService.requestAddBot(resolvedRoomId(), tableState.started());
        announceIfPresent(result);
    }

    public void removeBot() {
        BotActionResult result = botTableService.requestRemoveBot(resolvedRoomId(), tableState.started(), tableState.bots());
        announceIfPresent(result);
    }

    public void requestStartGame() {
        if (!ensureRoomSelected("demarrer la partie")) {
            return;
        }
        if (tableState.started()) {
            announce("La partie a deja commence.");
            return;
        }
        eventBus.publish(new StartRoomRequested(resolvedRoomId()));
    }

    public void togglePrivacy() {
        if (!ensureRoomSelected("changer la confidentialite")) {
            return;
        }
        try {
            Integer roomId = resolvedRoomId();
            if (roomId == null) {
                announce("Aucune table selectionnee pour changer la confidentialite.");
                return;
            }
            realtimeService.sendCommand("room.toggle-privacy", Map.of("roomId", roomId));
        } catch (Exception ex) {
            // Si l'envoi échoue, aucun message serveur n'arrivera : on reste silencieux.
        }
    }

    public void toggleSpectatorMode() {
        if (!ensureRoomSelected("changer le mode")) {
            return;
        }
        Integer roomId = resolvedRoomId();
        if (roomId == null) {
            announce("Aucune table selectionnee.");
            return;
        }
        boolean targetSpectator = !detailsState.spectator();
        try {
            realtimeService.sendCommand(
                    "room.set-role",
                    Map.of("roomId", roomId, "spectator", targetSpectator ? 1 : 0)
            );
        } catch (Exception e) {
            // Si l'envoi échoue, aucun message serveur n'arrivera : on reste silencieux.
        }
    }

    public void stopTrackingRoom() {
        lifecycleService.stopTracking();
    }

    public void announceTableSummary() {
        if (!ensureRoomSelected(null)) {
            return;
        }
        String tableSentence = resolveTableLabel();
        if (detailsState.spectator()) {
            tableSentence = tableSentence + ". Spectateur";
        }

        int playerCount = tableState.players() == null ? 0 : tableState.players().size();
        int botCount = tableState.bots() == null ? 0 : tableState.bots().size();
        int spectatorCount = tableState.spectatorCount();

        String playerNames = joinNames(
                tableState.players().stream().map(p -> p == null ? null : p.username()).toList(),
                "aucun"
        );

        announce(tableSentence
                + ". "
                + playerCount + " Joueurs : " + playerNames + ". "
                + botCount + " bot. "
                + spectatorCount + " spectateur.");
    }

  public void announceTurnInfo() {
    String message = turnController.formatTurn(currentTurn(), tableState);
    announcer.announceForce(historySidebar, message);
  }

    public void onBotAdded(BotAdded event) {
        if (!matchesCurrentRoom(event.roomId())) return;
        announce(botTableService.addedMessage(event.bot()));
    }

    public void onBotRemoved(BotRemoved event) {
        if (!matchesCurrentRoom(event.roomId())) return;
        announce(botTableService.removedMessage(event.botId(), event.name(), tableState));
    }

    public void onBotOperationFailed(BotOperationFailed event) {
        announce(event.message());
    }

    public void onRoomUpdated(RoomUpdated event) {
        if (!matchesCurrentRoom(event.room().id())) return;
        RoomState state = event.room();
        tableState.updateBots(state.bots());
        tableState.updatePlayers(state.players());
        tableState.updateStatus(state.status());
        tableState.updatePrivacy(state.isPrivate());
        if (state.counts() != null) {
            tableState.updateSpectatorCount(state.counts().spectators());
        } else {
            tableState.updateSpectatorCount(0);
        }
        RoomState.Owner owner = state.owner().orElse(null);
        tableState.updateOwner(owner != null ? owner.id() : null, owner != null ? owner.username() : null);
    }

    public void onRoomPrivacyChanged(RoomPrivacyChanged event) {
        if (!matchesCurrentRoom(event.roomId())) return;
        announce(narration.privacyMessage(event.isPrivate()));
    }

    public void onRoomOperationFailed(RoomOperationFailed event) {
        announce(event.message());
    }

    public boolean matchesCurrentRoom(Integer roomId) {
        Integer current = resolvedRoomId();
        return roomId != null && current != null && roomId.equals(current);
    }

    public TurnState currentTurn() {
        return new TurnState(tableState.turnRound(), tableState.turnIndex(), tableState.turnDirection(), tableState.currentPlayerId(), null);
    }

    private boolean ensureRoomSelected(String action) {
        if (resolvedRoomId() != null) {
            return true;
        }
        if (action == null) {
            announce("Aucune table selectionnee.");
        } else {
            announce("Aucune table selectionnee pour " + action + ".");
        }
        return false;
    }

    private Integer resolvedRoomId() {
        Integer id = detailsState.roomId();
        if (id != null) {
            return id;
        }
        return tableState.roomId();
    }

    private void announce(String message) {
        announcer.announce(historySidebar, message);
    }

    private String resolveTableLabel() {
        Integer roomId = resolvedRoomId();
        String name = detailsState.roomName();
        if (name != null) {
            name = name.trim();
        }
        if (name == null || name.isBlank()) {
            return roomId == null ? "Table" : "Table " + roomId;
        }
        return name;
    }

    private static String joinNames(java.util.List<String> names, String fallback) {
        if (names == null || names.isEmpty()) {
            return fallback;
        }
        String joined = names.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .collect(Collectors.joining(", "));
        return joined.isEmpty() ? fallback : joined;
    }

    private void announceIfPresent(BotActionResult result) {
        if (result.message() != null && !result.message().isBlank()) {
            announcer.announce(historySidebar, result.message());
        }
    }

    private static String clean(String message) {
        if (message == null) return "erreur";
        return message.replaceAll("\\s+", " ").trim();
    }

}
