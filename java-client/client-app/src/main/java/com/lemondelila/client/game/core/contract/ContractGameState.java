package com.lemondelila.client.game.core.contract;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public record ContractGameState(
        String status,
        String phase,
        int round,
        int turnIndex,
        Integer lastRoll,
        List<String> logs,
        boolean botThinking,
        List<ContractAction> actions,
        ContractPending pending,
        List<ContractActionLogEntry> actionLog,
        Map<String, Object> extras
) {
    public static ContractGameState empty() {
        return new ContractGameState("", "", 1, 0, null, List.of(), false, List.of(), null, List.of(), Map.of());
    }

    public List<String> logs() {
        return logs == null ? List.of() : Collections.unmodifiableList(logs);
    }

    public List<ContractAction> actions() {
        return actions == null ? List.of() : Collections.unmodifiableList(actions);
    }

    public List<ContractActionLogEntry> actionLog() {
        return actionLog == null ? List.of() : Collections.unmodifiableList(actionLog);
    }

    public Map<String, Object> extras() {
        return extras == null ? Map.of() : Collections.unmodifiableMap(extras);
    }
}

