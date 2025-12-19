package com.lemondelila.client.game.core.viewmodel;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.game.core.model.GenericGameState;

import java.util.ArrayList;
import java.util.HashMap;
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
        ArrayList<Map<String, Object>> parsed = new ArrayList<>();

        if (raw instanceof JsonNode node && node.isArray()) {
            raw = mapper.convertValue(node, List.class);
        }

        if (raw instanceof List<?> list) {
            for (Object item : list) {
                try {
                    Map<String, Object> m = mapper.convertValue(item, Map.class);
                    parsed.add(m);
                } catch (IllegalArgumentException ignored) {
                }
            }
        }

        // Raccourci générique jeux de plateaux : annoncer la position sur le plateau.
        if (hasBoard(state) && !containsKey(parsed, "pressed P")) {
            HashMap<String, Object> position = new HashMap<>();
            position.put("key", "pressed P");
            position.put("type", "interface");
            position.put("id", "position");
            parsed.add(position);
        }

        return parsed.isEmpty() ? List.of() : List.copyOf(parsed);
    }

    private static boolean hasBoard(GenericGameState state) {
        JsonNode board = state == null ? null : state.board();
        return board != null
                && board.isObject()
                && board.has("positions")
                && board.get("positions").isObject()
                && board.has("tiles")
                && board.get("tiles").isArray();
    }

    private static boolean containsKey(List<Map<String, Object>> shortcuts, String expected) {
        if (shortcuts == null || shortcuts.isEmpty() || expected == null) return false;
        for (Map<String, Object> sc : shortcuts) {
            if (sc == null) continue;
            String key = String.valueOf(sc.getOrDefault("key", "")).trim();
            if (key.equalsIgnoreCase(expected)) {
                return true;
            }
        }
        return false;
    }
}
