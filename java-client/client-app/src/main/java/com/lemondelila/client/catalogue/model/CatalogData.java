package com.lemondelila.client.catalogue.model;

import java.util.List;
import java.util.Objects;

public record CatalogData(List<CatalogCategory> categories,
                          List<GameSummary> games) {

    public CatalogData {
        Objects.requireNonNull(categories, "categories");
        Objects.requireNonNull(games, "games");
        categories = List.copyOf(categories);
        games = List.copyOf(games);
    }
}

