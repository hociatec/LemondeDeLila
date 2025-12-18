package com.lemondelila.client.game.core.viewmodel;

import com.lemondelila.client.game.core.model.GenericGameState;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

public final class AvailableActionMatcher {

    private AvailableActionMatcher() {}

    public static Optional<GenericGameState.GenericAction> findFirstMatching(
            List<GenericGameState.GenericAction> actions,
            String type,
            Map<String, Object> requiredPayload,
            Function<Object, Map<String, Object>> toPayload
    ) {
        if (actions == null || actions.isEmpty() || type == null || type.isBlank()) {
            return Optional.empty();
        }
        Objects.requireNonNull(requiredPayload, "requiredPayload");
        Objects.requireNonNull(toPayload, "toPayload");

        for (GenericGameState.GenericAction act : actions) {
            if (act == null || act.type() == null) continue;
            if (!type.equalsIgnoreCase(act.type())) continue;

            if (requiredPayload.isEmpty()) {
                return Optional.of(act);
            }

            Map<String, Object> payload = toPayload.apply(act.payload());
            if (payload == null) continue;
            if (payloadContains(payload, requiredPayload)) {
                return Optional.of(act);
            }
        }
        return Optional.empty();
    }

    private static boolean payloadContains(Map<String, Object> payload, Map<String, Object> required) {
        for (Map.Entry<String, Object> e : required.entrySet()) {
            String key = e.getKey();
            Object requiredValue = e.getValue();
            if (!payload.containsKey(key)) {
                return false;
            }
            Object actualValue = payload.get(key);
            if (requiredValue == null) {
                if (actualValue != null) {
                    return false;
                }
                continue;
            }
            if (!Objects.equals(String.valueOf(requiredValue), String.valueOf(actualValue))) {
                return false;
            }
        }
        return true;
    }
}

