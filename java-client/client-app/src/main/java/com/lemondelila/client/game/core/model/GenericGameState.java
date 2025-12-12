package com.lemondelila.client.game.core.model;

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
        PendingQuiz pendingQuiz,
        boolean botThinking,
        java.util.Map<String, Object> extras,
        List<GenericAction> actions,
        List<ActionLogEntry> actionLog,
        Object pending
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
                java.util.Map.<String, Object>of(),
                java.util.List.<GenericAction>of(),
                java.util.List.<ActionLogEntry>of(),
                null
        );
    }

    public List<String> logs() {
        return logs == null ? List.of() : Collections.unmodifiableList(logs);
    }

    public java.util.Map<String, Object> extras() {
        return extras == null ? java.util.Map.of() : java.util.Collections.unmodifiableMap(extras);
    }

    public List<GenericAction> actions() {
        return actions == null ? List.of() : Collections.unmodifiableList(actions);
    }

    public record PendingQuiz(String question, List<String> choices, Integer playerId) {
        public List<String> choices() {
            return choices == null ? List.of() : Collections.unmodifiableList(choices);
        }
    }

    public record PendingGeneric(String type, String name, Integer playerId, Integer targetPlayerId, Object raw) {}

    public record GenericAction(String type, String label, Object payload) {}

    public record ActionLogEntry(Integer actorId, String type, Object payload, Long timestamp, String step) {}
}
