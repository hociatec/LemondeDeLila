package com.lemondelila.client.game.catalog.model;

import java.util.List;

public record CatalogCategory(String id, String name, List<CatalogCategory> children) {
}
