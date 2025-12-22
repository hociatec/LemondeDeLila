package com.lemondelila.client.game.core.view;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.viewmodel.TurnAnnouncementTracker;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.room.service.RoomParticipantsMapper;
import com.lemondelila.client.game.turn.controller.TurnController;
import com.lemondelila.client.game.turn.model.TurnState;

import java.util.Objects;
import java.util.function.Consumer;

public final class GameTurnRenderer {

    private final TableState tableState;
    private final TurnController turnController;
    private final TurnAnnouncementTracker turnAnnouncementTracker;
    private final GameStatusRenderer statusRenderer;
    private final Consumer<String> announcer;

    public GameTurnRenderer(TableState tableState,
                            TurnController turnController,
                            TurnAnnouncementTracker turnAnnouncementTracker,
                            GameStatusRenderer statusRenderer,
                            Consumer<String> announcer) {
        this.tableState = Objects.requireNonNull(tableState, "tableState");
        this.turnController = Objects.requireNonNull(turnController, "turnController");
        this.turnAnnouncementTracker = Objects.requireNonNull(turnAnnouncementTracker, "turnAnnouncementTracker");
        this.statusRenderer = Objects.requireNonNull(statusRenderer, "statusRenderer");
        this.announcer = Objects.requireNonNull(announcer, "announcer");
    }

    public void renderTurn(GenericGameState state) {
        TurnState turn = state.turn();

        if (turn == null) {
            // Pas d'info de tour -> on évite d'annoncer un faux joueur.
            TurnState emptyTurn = new TurnState(state.round(), -1, 1, null, null);
            tableState.updateTurn(state.round(), -1, 1);
            tableState.updateCurrentPlayerId(null);
            tableState.updateLastTurn(emptyTurn);
            statusRenderer.renderTurnStatus(state, state.round(), -1);
            TurnAnnouncementTracker.Decision decision =
                    turnAnnouncementTracker.decide(tableState.started(), null, -1, state.round(), false, true);
            if (decision.announce()) {
                announcer.accept(turnController.formatTurn(emptyTurn, tableState));
            }
            return;
        }

        statusRenderer.renderTurnStatus(state, turn.round(), turn.index());
        tableState.updateTurn(turn.round(), turn.index(), turn.direction());
        tableState.updateCurrentPlayerId(turn.currentPlayerId());
        tableState.updateLastTurn(turn);

        // resynchronise l'ordre des participants avant d'annoncer le tour
        JsonNode players = state.players();
        if (players != null && players.isArray()) {
            RoomParticipantsMapper.updateFromPlayers(tableState, players);
        }

        if (!tableState.started()) {
            TurnAnnouncementTracker.Decision decision =
                    turnAnnouncementTracker.decide(false, null, -1, turn.round(), true, true);
            if (decision.announce()) {
                announcer.accept(turnController.formatTurn(turn, tableState));
            }
            return;
        }

        if (turn.index() < 0 && turn.currentPlayerId() == null) {
            // Ne rien annoncer si l'index est inconnu et pas d'ID courant.
            turnAnnouncementTracker.clearLastSeen();
            return;
        }

        TurnAnnouncementTracker.Decision decision =
                turnAnnouncementTracker.decide(true, turn.currentPlayerId(), turn.index(), turn.round(), true, true);
        if (decision.announce()) {
            announcer.accept(turnController.formatTurn(turn, tableState));
        }
    }
}

