package com.lemondelila.client.game.core.viewmodel;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PositionAnnouncementFormatterTest {

    @Test
    void formatPosition_usesTileInfoWhenAvailable() {
        PositionAnnouncementFormatter f = new PositionAnnouncementFormatter();
        assertEquals("Case 2/10, tour 3", f.formatPosition(1, 10, 3));
    }

    @Test
    void formatPosition_fallsBackToTurnOnly() {
        PositionAnnouncementFormatter f = new PositionAnnouncementFormatter();
        assertEquals("Tour 4", f.formatPosition(-1, 0, 4));
    }
}

