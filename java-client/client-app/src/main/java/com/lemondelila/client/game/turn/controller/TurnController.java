package com.lemondelila.client.game.turn.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.turn.model.TurnState;

import java.util.Objects;
import java.util.Optional;

/**
 * Contrôleur chargé de mapper l'état de tour et de fournir des annonces "serveur source de vérité".
 */
public final class TurnController {

    public Optional<TurnState> map(JsonNode turnNode) {
        if (turnNode == null || !turnNode.isObject()) {
            return Optional.empty();
        }
        int round = turnNode.path("round").asInt(1);
        int index = turnNode.path("index").asInt(-1);
        int direction = turnNode.path("direction").asInt(1);
        Integer currentPlayerId = turnNode.has("currentPlayerId") && turnNode.get("currentPlayerId").isInt()
                ? turnNode.get("currentPlayerId").asInt()
                : null;
        String label = turnNode.has("label") && turnNode.get("label").isTextual() ? turnNode.get("label").asText() : null;
        return Optional.of(new TurnState(round, index, direction, currentPlayerId, label));
    }

    public String formatTurn(TurnState turn, TableState tableState) {
        if (turn != null && turn.label() != null && !turn.label().isBlank()) {
            return turn.label();
        }
        if (tableState != null && tableState.started()) {
            String name = resolveCurrentName(turn, tableState);
            if (name != null && !name.isBlank()) {
                return Internationalization.text("game.turn.player", name);
            }
        }
        return Internationalization.text("game.turn.default");
    }

    private String resolveCurrentName(TurnState turn, TableState tableState) {
        Integer currentPlayerId = turn != null ? turn.currentPlayerId() : null;
        if (currentPlayerId != null) {
            var byId = tableState.players().stream()
                    .filter(p -> p != null && Objects.equals(p.id(), currentPlayerId))
                    .findFirst()
                    .orElse(null);
            if (byId != null && byId.username() != null && !byId.username().isBlank()) {
                return byId.username();
            }
            var bot = tableState.bots().stream()
                    .filter(b -> b != null && Objects.equals(b.id(), currentPlayerId))
                    .findFirst()
                    .orElse(null);
            if (bot != null && bot.name() != null && !bot.name().isBlank()) {
                return bot.name();
            }
        }

        int idx = turn != null ? turn.index() : -1;
        if (idx < 0) idx = tableState.turnIndex();
        var players = tableState.players();
        var bots = tableState.bots();
        if (idx >= 0 && idx < players.size()) {
            String username = players.get(idx).username();
            return username != null && !username.isBlank() ? username : null;
        }
        int botIdx = idx - players.size();
        if (botIdx >= 0 && botIdx < bots.size()) {
            String name = bots.get(botIdx).name();
            return name != null && !name.isBlank() ? name : null;
        }
        return null;
    }
}
