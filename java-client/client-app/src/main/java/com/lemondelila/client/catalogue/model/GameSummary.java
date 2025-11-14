package com.lemondelila.client.catalogue.model;

import java.util.Collections;
import java.util.List;
import java.util.Objects;

public record GameSummary(
        String code,
        String name,
        int minPlayers,
        int maxPlayers,
        String engine,
        String summary,
        boolean hasRules,
        List<String> categories
) {

    public GameSummary {
        Objects.requireNonNull(code, "code");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(categories, "categories");
    }

    public String displayLabel() {
        return name;
    }

    public List<String> categories() {
        return Collections.unmodifiableList(categories);
    }
}

