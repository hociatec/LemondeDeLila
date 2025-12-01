package com.lemondelila.client.game.catalog.model;

import java.util.List;

public record CatalogGame(
        String code,
        String name,
        String summary,
        int minPlayers,
        int maxPlayers,
        String engine,
        List<String> categories
) {
}
