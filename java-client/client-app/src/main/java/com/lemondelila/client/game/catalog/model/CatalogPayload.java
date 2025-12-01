package com.lemondelila.client.game.catalog.model;

import java.util.List;

public record CatalogPayload(List<CatalogCategory> categories, List<CatalogGame> games) {
}
