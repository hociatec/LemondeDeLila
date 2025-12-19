package com.lemondelila.client.game.core.viewmodel;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.game.core.model.GenericGameState;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DynamicShortcutResolver {

    private final ObjectMapper mapper;

    public DynamicShortcutResolver(ObjectMapper mapper) {
        this.mapper = Objects.requireNonNull(mapper, "mapper");
    }

    public List<Map<String, Object>> resolve(GenericGameState state, boolean allowDynamic) {
        if (!allowDynamic) return List.of();

        JsonNode extras = state == null ? null : state.extras();
        Object raw = extras != null && extras.isObject() ? extras.get("shortcuts") : null;
        if (raw == null) {
            return List.of();
        }

        if (raw instanceof JsonNode node && node.isArray()) {
            raw = mapper.convertValue(node, List.class);
        }

        if (raw instanceof List<?> list) {
            ArrayList<Map<String, Object>> parsed = new ArrayList<>();
            for (Object item : list) {
                try {
                    Map<String, Object> m = mapper.convertValue(item, Map.class);
                    parsed.add(m);
                } catch (IllegalArgumentException ignored) {
                }
            }
            return parsed.isEmpty() ? List.of() : List.copyOf(parsed);
        }

        return List.of();
    }
}

