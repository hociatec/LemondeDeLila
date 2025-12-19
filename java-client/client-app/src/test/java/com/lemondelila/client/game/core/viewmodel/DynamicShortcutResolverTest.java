package com.lemondelila.client.game.core.viewmodel;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.service.GenericGameStateMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DynamicShortcutResolverTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final GenericGameStateMapper stateMapper = new GenericGameStateMapper();

    @Test
    void resolve_returnsShortcutsWhenAllowed() throws Exception {
        JsonNode json = mapper.readTree("""
                {
                  "status":"started",
                  "extras": {
                    "shortcuts": [
                      { "key": "pressed S", "type": "interface", "id": "shopping" },
                      { "key": "pressed D", "type": "action", "actionType": "draw" }
                    ]
                  }
                }
                """);
        GenericGameState state = stateMapper.map(json);

        DynamicShortcutResolver resolver = new DynamicShortcutResolver(mapper);
        List<Map<String, Object>> shortcuts = resolver.resolve(state, true);
        assertEquals(2, shortcuts.size());
        assertEquals("pressed S", shortcuts.getFirst().get("key"));
        assertEquals("interface", shortcuts.getFirst().get("type"));
        assertEquals("shopping", shortcuts.getFirst().get("id"));
    }

    @Test
    void resolve_returnsEmptyWhenNotAllowed() throws Exception {
        JsonNode json = mapper.readTree("""
                { "status":"started", "extras": { "shortcuts": [ { "key": "pressed S" } ] } }
                """);
        GenericGameState state = stateMapper.map(json);

        DynamicShortcutResolver resolver = new DynamicShortcutResolver(mapper);
        assertTrue(resolver.resolve(state, false).isEmpty());
    }
}

