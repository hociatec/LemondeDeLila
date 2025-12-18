package com.lemondelila.client.game.core.viewmodel;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StatsAnnouncementFormatterTest {

    @Test
    void format_containsAllNumbers() {
        StatsAnnouncementFormatter f = new StatsAnnouncementFormatter();
        assertEquals("Pollution: 1/2 | Familles complétées: 3/4", f.format(1, 2, 3, 4));
    }
}

