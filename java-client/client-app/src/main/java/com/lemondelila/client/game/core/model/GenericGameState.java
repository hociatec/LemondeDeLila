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
        java.util.Map<String, Object> extras
) {
    public static GenericGameState empty() {
        return new GenericGameState("", "", 1, 0, null, List.of(), null, java.util.Map.of());
    }

    public List<String> logs() {
        return logs == null ? List.of() : Collections.unmodifiableList(logs);
    }

    public java.util.Map<String, Object> extras() {
        return extras == null ? java.util.Map.of() : java.util.Collections.unmodifiableMap(extras);
    }

    public record PendingQuiz(String question, List<String> choices, Integer playerId) {
        public List<String> choices() {
            return choices == null ? List.of() : Collections.unmodifiableList(choices);
        }
    }
}
