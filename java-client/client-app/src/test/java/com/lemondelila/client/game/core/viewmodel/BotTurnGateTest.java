package com.lemondelila.client.game.core.viewmodel;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BotTurnGateTest {

    @Test
    void shouldBlock_falseBeforeStart() {
        BotTurnGate gate = new BotTurnGate();
        assertFalse(gate.shouldBlock(false, true, false, false));
    }

    @Test
    void shouldBlock_falseWhenQuizActive() {
        BotTurnGate gate = new BotTurnGate();
        assertFalse(gate.shouldBlock(true, true, true, false));
    }

    @Test
    void shouldBlock_falseWhenAskTargetsMe() {
        BotTurnGate gate = new BotTurnGate();
        assertFalse(gate.shouldBlock(true, true, false, true));
    }

    @Test
    void shouldBlock_trueWhenLocked() {
        BotTurnGate gate = new BotTurnGate();
        assertTrue(gate.shouldBlock(true, true, false, false));
    }
}

