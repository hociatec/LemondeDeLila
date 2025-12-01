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
import com.lemondelila.client.game.history.service.RoomNarrationService.RoomSummary;
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

import java.util.Map;

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
            announce("Impossible de changer la confidentialite : " + ex.getMessage());
        }
    }

    public void stopTrackingRoom() {
        lifecycleService.stopTracking();
    }

    public void announceTableSummary() {
        if (!ensureRoomSelected(null)) {
            return;
        }
        RoomSummary summary = narration.summarize(tableState);
        announce(narration.summarySentence(summary));
    }

    public void announceTurnInfo() {
        String message = turnController.formatTurn(currentTurn(), tableState);
        announce(message);
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
        announce("Action bot impossible : " + event.message());
    }

    public void onRoomUpdated(RoomUpdated event) {
        if (!matchesCurrentRoom(event.room().id())) return;
        RoomState state = event.room();
        tableState.updateBots(state.bots());
        tableState.updatePlayers(state.players());
        tableState.updateStatus(state.status());
    }

    public void onRoomPrivacyChanged(RoomPrivacyChanged event) {
        if (!matchesCurrentRoom(event.roomId())) return;
        announce(narration.privacyMessage(event.isPrivate()));
    }

    public void onRoomOperationFailed(RoomOperationFailed event) {
        announce("Action table impossible : " + event.message());
    }

    public boolean matchesCurrentRoom(Integer roomId) {
        Integer current = resolvedRoomId();
        return roomId != null && current != null && roomId.equals(current);
    }

    public TurnState currentTurn() {
        return new TurnState(tableState.turnRound(), tableState.turnIndex(), tableState.turnDirection());
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

    private void announceIfPresent(BotActionResult result) {
        if (result.message() != null && !result.message().isBlank()) {
            announcer.announce(historySidebar, result.message());
        }
    }

}
