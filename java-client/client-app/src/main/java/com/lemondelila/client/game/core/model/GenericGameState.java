package com.lemondelila.client.game.core.model;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.game.turn.model.TurnState;

import java.util.Collections;
import java.util.List;

/**
 * Représentation générique d'un état de jeu pour l'affichage (statut, logs, quiz...).
 */
public record GenericGameState(
        String status,
        String phase,
        int round,
        int turnIndex,
        Integer lastRoll,
        List<String> logs,
        TurnState turn,
        boolean botThinking,
        JsonNode players,
        JsonNode board,
        JsonNode metadata,
        JsonNode extras,
        List<GenericAction> actions,
        List<ActionLogEntry> actionLog,
        Pending pending
) {
    public static GenericGameState empty() {
        return new GenericGameState(
                "",
                "",
                1,
                0,
                null,
                java.util.List.<String>of(),
                null,
                false,
                null,
                null,
                null,
                null,
                java.util.List.<GenericAction>of(),
                java.util.List.<ActionLogEntry>of(),
                null
        );
    }

    public List<String> logs() {
        return logs == null ? List.of() : Collections.unmodifiableList(logs);
    }

    public List<GenericAction> actions() {
        return actions == null ? List.of() : Collections.unmodifiableList(actions);
    }

    public sealed interface Pending permits PendingQuiz, PendingGeneric {
        String type();
    }

    public record PendingQuiz(String question, List<String> choices, Integer playerId) implements Pending {
        @Override
        public String type() {
            return "quiz";
        }

        public List<String> choices() {
            return choices == null ? List.of() : Collections.unmodifiableList(choices);
        }
    }

    public record PendingGeneric(String type, String name, Integer playerId, Integer targetPlayerId, Object raw) implements Pending {}

    public record GenericAction(String type, String label, Object payload) {}

    public record ActionLogEntry(Integer actorId, String type, JsonNode payload, Long timestamp, String step) {}
}
