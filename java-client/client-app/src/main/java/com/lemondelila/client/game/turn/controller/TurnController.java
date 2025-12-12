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
        int index = turnNode.path("index").asInt(-1);
        int direction = turnNode.path("direction").asInt(1);
        Integer currentPlayerId = turnNode.has("currentPlayerId") && turnNode.get("currentPlayerId").isInt()
                ? turnNode.get("currentPlayerId").asInt()
                : null;
        return Optional.of(new TurnState(round, index, direction, currentPlayerId));
    }

    public String formatTurn(TurnState turn, TableState tableState) {
        if (tableState != null && !tableState.started()) {
            String game = tableState.gameType() == null ? "La table" : "La table " + tableState.gameType();
            return game + " a été créée, ajoutez des bots et démarrez-la !";
        }
        String name = resolveName(turn, tableState);
        return "Tour de " + name + ".";
    }

    private String resolveName(TurnState turn, TableState tableState) {
        String fallback = "Joueur";
        if (tableState == null) {
            return fallback;
        }
        // Priorité absolue : currentPlayerId
        if (turn.currentPlayerId() != null) {
            Integer id = turn.currentPlayerId();
            String byPlayer = tableState.players().stream()
                    .filter(p -> p.id() != null && p.id().equals(id))
                    .map(p -> p.username() == null || p.username().isBlank() ? "Joueur" : p.username())
                    .findFirst()
                    .orElse(null);
            if (byPlayer != null) {
                return byPlayer;
            }
            String byBot = tableState.bots().stream()
                    .filter(b -> b.id() != null && b.id().equals(id))
                    .map(b -> b.name() == null || b.name().isBlank() ? "Bot" : b.name())
                    .findFirst()
                    .orElse(null);
            if (byBot != null) {
                return byBot;
            }
            // Fallback : si l'ID est présent mais pas trouvé dans les listes locales, au moins varier le libellé.
            if (id != null) {
                return "Joueur " + id;
            }
        }
        var order = tableState.participantOrder();
        if (turn.index() >= 0 && turn.index() < order.size()) {
            Integer id = order.get(turn.index());
            if (id != null) {
                String byPlayer = tableState.players().stream()
                        .filter(p -> p.id() != null && p.id().equals(id))
                        .map(p -> p.username() == null || p.username().isBlank() ? "Joueur" : p.username())
                        .findFirst()
                        .orElse(null);
                if (byPlayer != null) {
                    return byPlayer;
                }
                String byBot = tableState.bots().stream()
                        .filter(b -> b.id() != null && b.id().equals(id))
                        .map(b -> b.name() == null || b.name().isBlank() ? "Bot" : b.name())
                    .findFirst()
                    .orElse(null);
                if (byBot != null) {
                    return byBot;
                }
            }
        }

        var players = tableState.players();
        var bots = tableState.bots();
        int totalPlayers = players.size();
        int totalParticipants = totalPlayers + bots.size();

        if (turn.index() >= 0 && turn.index() < totalParticipants) {
            if (turn.index() < totalPlayers) {
                String candidate = players.get(turn.index()).username();
                if (candidate != null && !candidate.isBlank()) {
                    return candidate;
                }
                return "Joueur";
            } else {
                int botIndex = turn.index() - totalPlayers;
                if (botIndex >= 0 && botIndex < bots.size()) {
                    String botName = bots.get(botIndex).name();
                    if (botName != null && !botName.isBlank()) {
                        return botName;
                    }
                    return "Bot";
                }
            }
        }
        // Ultime fallback : si des bots existent, annoncer le premier bot plutôt que "Joueur".
        if (!bots.isEmpty()) {
            String botName = bots.get(0).name();
            return (botName == null || botName.isBlank()) ? "Bot" : botName;
        }
        return fallback;
    }
}
