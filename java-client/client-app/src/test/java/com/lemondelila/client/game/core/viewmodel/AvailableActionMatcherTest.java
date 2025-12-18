package com.lemondelila.client.game.core.viewmodel;

import com.lemondelila.client.game.core.model.GenericGameState;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AvailableActionMatcherTest {

    @Test
    void findFirstMatching_matchesTypeAndSubsetPayload() {
        List<GenericGameState.GenericAction> actions = List.of(
                new GenericGameState.GenericAction("draw", "Pioche", Map.of()),
                new GenericGameState.GenericAction("answer_quiz", "A", Map.of("answer", "A", "playerId", 1)),
                new GenericGameState.GenericAction("answer_quiz", "B", Map.of("answer", "B", "playerId", 1))
        );

        Optional<GenericGameState.GenericAction> found = AvailableActionMatcher.findFirstMatching(
                actions,
                "answer_quiz",
                Map.of("answer", "B"),
                raw -> (Map<String, Object>) raw
        );

        assertTrue(found.isPresent());
        assertEquals("B", ((Map<?, ?>) found.get().payload()).get("answer"));
    }

    @Test
    void findFirstMatching_returnsEmptyWhenNoPayloadMatch() {
        List<GenericGameState.GenericAction> actions = List.of(
                new GenericGameState.GenericAction("discard_card", "X", Map.of("memberId", "1"))
        );

        Optional<GenericGameState.GenericAction> found = AvailableActionMatcher.findFirstMatching(
                actions,
                "discard_card",
                Map.of("memberId", "2"),
                raw -> (Map<String, Object>) raw
        );

        assertTrue(found.isEmpty());
    }
}

