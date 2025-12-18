package com.lemondelila.client.game.core.viewmodel;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ListAnnouncementFormatterTest {

    @Test
    void format_emptyUsesEmptyText() {
        ListAnnouncementFormatter f = new ListAnnouncementFormatter();
        assertEquals("Main vide", f.format("Main", List.of(), "Main vide"));
    }

    @Test
    void format_nonEmptyJoinsValues() {
        ListAnnouncementFormatter f = new ListAnnouncementFormatter();
        assertEquals("Main : A, B", f.format("Main", List.of("A", "B"), "Main vide"));
    }
}

