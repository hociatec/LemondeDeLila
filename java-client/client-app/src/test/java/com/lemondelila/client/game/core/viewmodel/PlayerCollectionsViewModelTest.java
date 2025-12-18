package com.lemondelila.client.game.core.viewmodel;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlayerCollectionsViewModelTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final PlayerCollectionsViewModel vm = new PlayerCollectionsViewModel();

    @Test
    void resolve_prefersPlayerViewsMatchById() throws Exception {
        var extras = mapper.readTree("""
                {
                  "playerViews":[
                    {"id":1,"username":"A","shoppingList":["s"],"basket":["b"],"inventory":["i"]},
                    {"id":2,"username":"B","shoppingList":["x"],"basket":["y"],"inventory":["z"]}
                  ]
                }
                """);
        var r = vm.resolve(extras, 2, null).orElseThrow();
        assertEquals(2, r.playerId());
        assertEquals(java.util.List.of("x"), r.shopping());
    }

    @Test
    void resolve_fallsBackToFirstNonBotWithId() throws Exception {
        var extras = mapper.readTree("""
                {
                  "players":[
                    {"id":10,"isBot":true,"shoppingList":["a"]},
                    {"id":11,"isBot":false,"shoppingList":["b"],"basket":[],"inventory":[]}
                  ]
                }
                """);
        var r = vm.resolve(extras, null, null).orElseThrow();
        assertEquals(11, r.playerId());
        assertEquals(java.util.List.of("b"), r.shopping());
    }

    @Test
    void resolve_usesCurrentPlayerViewWhenNoArrays() throws Exception {
        var extras = mapper.readTree("""
                {
                  "currentPlayerView":{"id":5,"shoppingList":["s"],"basket":["b"],"inventory":["i"]}
                }
                """);
        var r = vm.resolve(extras, null, null).orElseThrow();
        assertEquals(5, r.playerId());
        assertEquals(java.util.List.of("b"), r.basket());
    }

    @Test
    void resolve_returnsEmptyWhenNoId() throws Exception {
        var extras = mapper.readTree("{\"currentPlayerView\":{\"username\":\"x\"}}");
        assertTrue(vm.resolve(extras, null, null).isEmpty());
    }
}

