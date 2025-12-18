package com.lemondelila.client.game.core.viewmodel;

import java.util.List;

public final class ListAnnouncementFormatter {

    public String format(String label, List<String> values, String emptyText) {
        String safeLabel = (label == null || label.isBlank()) ? "" : label.trim();
        if (values == null || values.isEmpty()) {
            return emptyText;
        }
        return safeLabel.isEmpty() ? String.join(", ", values) : safeLabel + " : " + String.join(", ", values);
    }
}

