package com.lemondelila.client.game.core.viewmodel;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CollectionAnnouncementFormatterTest {

    @Test
    void formatCollectionAnnouncement_empty() {
        CollectionAnnouncementFormatter f = new CollectionAnnouncementFormatter();
        assertEquals("Panier vide", f.formatCollectionAnnouncement("basket", List.of()));
    }

    @Test
    void formatCollectionAnnouncement_values() {
        CollectionAnnouncementFormatter f = new CollectionAnnouncementFormatter();
        assertEquals("Inventaire : A, B", f.formatCollectionAnnouncement("inventory", List.of("A", "B")));
    }
}

