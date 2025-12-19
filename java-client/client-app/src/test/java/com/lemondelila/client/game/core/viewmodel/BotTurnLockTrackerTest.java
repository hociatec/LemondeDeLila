package com.lemondelila.client.game.core.viewmodel;

import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.TableState;
import org.junit.jupiter.api.Test;

import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class BotTurnLockTrackerTest {

    @Test
    void update_locksWhenBotThinkingFlag() {
        TableState table = new TableState();
        BotTurnLockTracker tracker = new BotTurnLockTracker(table);

        AtomicReference<String> label = new AtomicReference<>("init");
        GenericGameState state = new GenericGameState(
                "started",
                "",
                1,
                0,
                null,
                null,
                null,
                true,
                null,
                null,
                null,
                null,
                null,
                null,
                null
        );

        tracker.update(state, label::set);
        assertTrue(tracker.locked());
        assertEquals("Tour du bot, merci de patienter...", label.get());
    }

    @Test
    void update_locksWhenCurrentPlayerIsBotEvenWithoutFlag() {
        TableState table = new TableState();
        table.updateBots(java.util.List.of(new BotState(99, "Bot")));
        table.updateCurrentPlayerId(99);

        BotTurnLockTracker tracker = new BotTurnLockTracker(table);
        AtomicReference<String> label = new AtomicReference<>("");

        tracker.update(null, label::set);
        assertTrue(tracker.locked());
        assertEquals("Tour du bot, merci de patienter...", label.get());
    }

    @Test
    void update_clearsLockAndLabelWhenNotBotTurn() {
        TableState table = new TableState();
        BotTurnLockTracker tracker = new BotTurnLockTracker(table);
        AtomicReference<String> label = new AtomicReference<>("x");

        tracker.update(null, label::set);
        assertFalse(tracker.locked());
        assertEquals("", label.get());
    }
}

