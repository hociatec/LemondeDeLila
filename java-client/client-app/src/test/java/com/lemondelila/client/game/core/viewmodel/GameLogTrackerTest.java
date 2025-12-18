package com.lemondelila.client.game.core.viewmodel;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GameLogTrackerTest {

    @Test
    void consumeNewAnnouncements_sanitizesAndTracksIndex() {
        GameAnnouncementFormatter formatter = new GameAnnouncementFormatter();
        GameLogTracker tracker = new GameLogTracker(formatter);

        List<String> first = tracker.consumeNewAnnouncements(
                List.of("[Panier Express] A", "[Panier Express] B"),
                true
        );
        assertEquals(List.of("A", "B"), first);

        List<String> second = tracker.consumeNewAnnouncements(
                List.of("[Panier Express] A", "[Panier Express] B", "C"),
                true
        );
        assertEquals(List.of("C"), second);
    }

    @Test
    void consumeNewAnnouncements_returnsEmptyWhenNotStarted() {
        GameLogTracker tracker = new GameLogTracker(new GameAnnouncementFormatter());
        assertEquals(List.of(), tracker.consumeNewAnnouncements(List.of("A"), false));
    }
}

