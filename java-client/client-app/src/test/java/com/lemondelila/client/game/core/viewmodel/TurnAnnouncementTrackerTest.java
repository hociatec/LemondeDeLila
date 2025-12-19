package com.lemondelila.client.game.core.viewmodel;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TurnAnnouncementTrackerTest {

    @Test
    void decide_announcesOncePerTurn() {
        TurnAnnouncementTracker t = new TurnAnnouncementTracker();
        var d1 = t.decide(true, 1, 0, 1, true, true);
        assertTrue(d1.announce());
        var d2 = t.decide(true, 1, 0, 1, true, true);
        assertFalse(d2.announce());
        var d3 = t.decide(true, 2, 1, 1, true, true);
        assertTrue(d3.announce());
    }

    @Test
    void decide_pregameAnnouncesOnceWhenNoTurnInfo() {
        TurnAnnouncementTracker t = new TurnAnnouncementTracker();
        var d1 = t.decide(false, null, -1, 1, false, true);
        assertTrue(d1.announce());
        var d2 = t.decide(false, null, -1, 1, false, true);
        assertFalse(d2.announce());
    }

    @Test
    void clearLastSeen_doesNotResetPregameFlag() {
        TurnAnnouncementTracker t = new TurnAnnouncementTracker();
        assertTrue(t.decide(false, null, -1, 1, false, true).announce());
        t.clearLastSeen();
        assertFalse(t.decide(false, null, -1, 1, false, true).announce());
    }
}
