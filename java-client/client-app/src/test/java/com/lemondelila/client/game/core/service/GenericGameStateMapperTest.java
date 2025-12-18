package com.lemondelila.client.game.core.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.game.core.contract.ContractGameState;
import com.lemondelila.client.game.core.contract.ContractPending;
import com.lemondelila.client.game.core.model.GenericGameState;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class GenericGameStateMapperTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private final GenericGameStateMapper stateMapper = new GenericGameStateMapper();

    @Test
    void mapsQuizPending() throws Exception {
        JsonNode node = mapper.readTree("""
                {
                  "status":"started",
                  "pending": { "type":"quiz", "question":"Q?", "choices":["a","b"], "playerId": 7 },
                  "actions":[{"type":"answer_quiz","label":"Répondre","payload":{"choice":"a"}}],
                  "metadata": { "actionLog":[{"actorId":7,"type":"quiz","timestamp":123,"step":"quiz","payload":{"choice":"a"}}] }
                }
                """);

        GenericGameState state = stateMapper.map(node);
        assertEquals("started", state.status());
        assertNotNull(state.pending());
        assertTrue(state.pending() instanceof GenericGameState.PendingQuiz);
        GenericGameState.PendingQuiz quiz = (GenericGameState.PendingQuiz) state.pending();
        assertEquals("Q?", quiz.question());
        assertEquals(2, quiz.choices().size());
        assertEquals(7, quiz.playerId());
        assertEquals(1, state.actions().size());
        assertEquals("answer_quiz", state.actions().getFirst().type());
        assertEquals(1, state.actionLog().size());
        assertEquals("quiz", state.actionLog().getFirst().type());

        ContractGameState contract = stateMapper.mapContract(node);
        assertNotNull(contract.pending());
        assertTrue(contract.pending() instanceof ContractPending.Quiz);
    }

    @Test
    void mapsVotePendingAsGenericPending() throws Exception {
        JsonNode node = mapper.readTree("""
                {
                  "status":"pending",
                  "pending": { "type":"vote", "name":"Qui ?", "day": 2 }
                }
                """);

        GenericGameState state = stateMapper.map(node);
        assertEquals("pending", state.status());
        assertFalse(state.pending() instanceof GenericGameState.PendingQuiz);
        assertNotNull(state.pending());
        assertTrue(state.pending() instanceof GenericGameState.PendingGeneric);
        GenericGameState.PendingGeneric pending = (GenericGameState.PendingGeneric) state.pending();
        assertEquals("vote", pending.type());
        assertEquals("Qui ?", pending.name());
    }

    @Test
    void mapsExchangePendingAsGenericPending() throws Exception {
        JsonNode node = mapper.readTree("""
                {
                  "status":"pending",
                  "pending": { "type":"exchange", "playerId": 1, "targetPlayerId": 2, "card":"exchange" }
                }
                """);

        GenericGameState state = stateMapper.map(node);
        assertNotNull(state.pending());
        assertTrue(state.pending() instanceof GenericGameState.PendingGeneric);
        GenericGameState.PendingGeneric pending = (GenericGameState.PendingGeneric) state.pending();
        assertEquals("exchange", pending.type());
        assertEquals(1, pending.playerId());
        assertEquals(2, pending.targetPlayerId());
    }

    @Test
    void mapsPhasePendingAsGenericPending() throws Exception {
        JsonNode node = mapper.readTree("""
                {
                  "status":"started",
                  "pending": { "type":"phase", "name":"setup", "day": 1 }
                }
                """);

        GenericGameState state = stateMapper.map(node);
        assertNotNull(state.pending());
        assertTrue(state.pending() instanceof GenericGameState.PendingGeneric);
        GenericGameState.PendingGeneric pending = (GenericGameState.PendingGeneric) state.pending();
        assertEquals("phase", pending.type());
        assertEquals("setup", pending.name());
    }
}
