package com.lemondelila.client.catalogue.presenter;

/**
 * View model représentant une catégorie dans la liste de navigation.
 */
public record CatalogCategoryItem(String id, String label, boolean hasChildren, int gameCount) {
}

