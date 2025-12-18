package com.lemondelila.client.game.core.viewmodel;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GameExchangeNavigatorTest {

    @Test
    void nextIndex_wrapsAndClamps() {
        GameExchangeNavigator nav = new GameExchangeNavigator();
        assertEquals(-1, nav.nextIndex(0, 0, 1));
        assertEquals(0, nav.nextIndex(-1, 3, 1));
        assertEquals(1, nav.nextIndex(0, 3, 1));
        assertEquals(2, nav.nextIndex(0, 3, -1));
    }

    @Test
    void shouldAnnounce_onlyOnChangeAndResetsWhenInactive() {
        GameExchangeNavigator nav = new GameExchangeNavigator();
        assertTrue(nav.shouldAnnounce(0, true, 2));
        assertFalse(nav.shouldAnnounce(0, true, 2));
        assertTrue(nav.shouldAnnounce(1, true, 2));
        assertFalse(nav.shouldAnnounce(0, false, 2));
        assertTrue(nav.shouldAnnounce(0, true, 2));
    }
}

