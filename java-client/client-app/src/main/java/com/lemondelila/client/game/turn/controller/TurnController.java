package com.lemondelila.client.game.turn.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.turn.model.TurnState;

import java.util.Optional;

/**
 * Contrôleur chargé de mapper l'état de tour et de fournir des annonces formatées.
 */
public final class TurnController {

    public Optional<TurnState> map(JsonNode turnNode) {
        if (turnNode == null || !turnNode.isObject()) {
            return Optional.empty();
        }
        int round = turnNode.path("round").asInt(1);
        int index = turnNode.path("index").asInt(0);
        int direction = turnNode.path("direction").asInt(1);
        return Optional.of(new TurnState(round, index, direction));
    }

    public String formatTurn(TurnState turn, TableState tableState) {
        String name = "Joueur";
        var players = tableState.players();
        if (turn.index() >= 0 && turn.index() < players.size()) {
            String candidate = players.get(turn.index()).username();
            if (candidate != null && !candidate.isBlank()) {
                name = candidate;
            }
        }
        return "Tour de " + name + " (round " + turn.round() + ", " + turn.directionLabel() + ").";
    }
}
