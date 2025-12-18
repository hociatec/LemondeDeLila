package com.lemondelila.client.game.core.viewmodel;

import java.util.List;

public final class CollectionAnnouncementFormatter {

    public String formatCollectionName(String key) {
        if (key == null) return "Collection";
        return switch (key.toLowerCase()) {
            case "shopping", "s" -> "Liste";
            case "basket", "b" -> "Panier";
            case "inventory", "i" -> "Inventaire";
            default -> "Collection";
        };
    }

    public String formatCollectionAnnouncement(String key, List<String> values) {
        String label = formatCollectionName(key);
        if (values == null || values.isEmpty()) {
            return label + " vide";
        }
        return label + " : " + String.join(", ", values);
    }
}

