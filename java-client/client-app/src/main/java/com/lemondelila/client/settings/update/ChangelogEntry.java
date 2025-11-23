package com.lemondelila.client.settings.update;

import java.util.List;

public record ChangelogEntry(
        String version,
        List<String> highlights,
        List<String> fixes,
        String notes
) {
    public ChangelogEntry {
        if (highlights == null) {
            highlights = List.of();
        }
        if (fixes == null) {
            fixes = List.of();
        }
        if (notes != null && notes.isBlank()) {
            notes = null;
        }
    }
}
