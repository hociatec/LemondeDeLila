package com.lemondelila.client.gamelogic.panierexpress.model;

import java.util.Collections;
import java.util.List;

public record PanierExpressState(
        String status,
        String phase,
        int round,
        int turnIndex,
        Integer lastRoll,
        List<String> players,
        List<PanierExpressLogEntry> logs,
        PendingQuiz pendingQuiz
) {
    public static PanierExpressState empty() {
        return new PanierExpressState("", "", 1, 0, null, List.of(), List.of(), null);
    }

    public record PendingQuiz(String question, List<String> choices, Integer playerId) {
        public List<String> choices() {
            return choices == null ? List.of() : Collections.unmodifiableList(choices);
        }
    }

    public List<String> players() {
        return players == null ? List.of() : Collections.unmodifiableList(players);
    }

    public List<PanierExpressLogEntry> logs() {
        return logs == null ? List.of() : Collections.unmodifiableList(logs);
    }
}
