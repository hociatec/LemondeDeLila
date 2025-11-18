package com.lemondelila.client.catalogue.presenter;

import com.lemondelila.client.catalogue.model.CatalogCategory;
import com.lemondelila.client.catalogue.model.CatalogData;
import com.lemondelila.client.catalogue.model.GameSummary;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Encapsule l'indexation des catégories et jeux afin de simplifier le presenter.
 */
final class CatalogDataIndex {

    static final String ROOT_CATEGORY = "__root__";

    private Map<String, CatalogCategory> categoryIndex = Map.of();
    private Map<String, List<CatalogCategory>> childrenIndex = Map.of();
    private Map<String, List<GameSummary>> gamesByCategory = Map.of();
    private Map<String, GameSummary> gameIndex = Map.of();
    private Map<String, String> breadcrumbs = Map.of();

    void load(CatalogData catalog) {
        Objects.requireNonNull(catalog, "catalog");

        Map<String, CatalogCategory> newCategoryIndex = new LinkedHashMap<>();
        Map<String, List<CatalogCategory>> newChildrenIndex = new LinkedHashMap<>();
        indexCategories(catalog.categories(), ROOT_CATEGORY, newCategoryIndex, newChildrenIndex);

        Map<String, List<GameSummary>> newGamesByCategory = new LinkedHashMap<>();
        Map<String, GameSummary> newGameIndex = new LinkedHashMap<>();
        for (GameSummary game : catalog.games()) {
            if (game == null || game.code() == null) {
                continue;
            }
            newGameIndex.put(game.code(), game);
            for (String categoryId : game.categories()) {
                newGamesByCategory
                        .computeIfAbsent(categoryId, key -> new ArrayList<>())
                        .add(game);
            }
        }

        newChildrenIndex.replaceAll((id, list) -> List.copyOf(list));
        newGamesByCategory.replaceAll((id, list) -> {
            List<GameSummary> sorted = new ArrayList<>(list);
            sorted.sort((a, b) -> String.CASE_INSENSITIVE_ORDER.compare(a.name(), b.name()));
            return List.copyOf(sorted);
        });

        this.categoryIndex = Map.copyOf(newCategoryIndex);
        this.childrenIndex = Map.copyOf(newChildrenIndex);
        this.gamesByCategory = Map.copyOf(newGamesByCategory);
        this.gameIndex = Map.copyOf(newGameIndex);
        this.breadcrumbs = buildBreadcrumbs(catalog.categories());
    }

    void registerRemoteGames(List<GameSummary> games) {
        if (games == null || games.isEmpty()) {
            return;
        }
        Map<String, List<GameSummary>> updatedGamesByCategory = new LinkedHashMap<>(gamesByCategory);
        Map<String, GameSummary> updatedGameIndex = new LinkedHashMap<>(gameIndex);

        for (GameSummary game : games) {
            if (game == null || game.code() == null) {
                continue;
            }
            updatedGameIndex.put(game.code(), game);
            for (String categoryId : game.categories()) {
                List<GameSummary> existing = updatedGamesByCategory.get(categoryId);
                List<GameSummary> modifiable = existing == null ? new ArrayList<>() : new ArrayList<>(existing);
                boolean alreadyPresent = modifiable.stream()
                        .anyMatch(existingGame -> existingGame.code().equals(game.code()));
                if (!alreadyPresent) {
                    modifiable.add(game);
                    modifiable.sort((a, b) -> String.CASE_INSENSITIVE_ORDER.compare(a.name(), b.name()));
                }
                updatedGamesByCategory.put(categoryId, List.copyOf(modifiable));
            }
        }

        gamesByCategory = Map.copyOf(updatedGamesByCategory);
        gameIndex = Map.copyOf(updatedGameIndex);
    }

    List<CatalogCategory> childrenOf(String categoryId) {
        return childrenIndex.getOrDefault(categoryId, List.of());
    }

    List<GameSummary> gamesOf(String categoryId) {
        return gamesByCategory.getOrDefault(categoryId, List.of());
    }

    Optional<GameSummary> gameByCode(String code) {
        if (code == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(gameIndex.get(code));
    }

    String breadcrumbLabel(String categoryId) {
        if (categoryId == null || categoryId.equals(ROOT_CATEGORY)) {
            return "Categories";
        }
        return breadcrumbs.getOrDefault(categoryId, "Categorie");
    }

    private void indexCategories(List<CatalogCategory> categories,
                                 String parentId,
                                 Map<String, CatalogCategory> index,
                                 Map<String, List<CatalogCategory>> children) {
        List<CatalogCategory> bucket = children.computeIfAbsent(parentId, key -> new ArrayList<>());
        for (CatalogCategory category : categories) {
            index.put(category.id(), category);
            bucket.add(category);
            indexCategories(category.children(), category.id(), index, children);
        }
    }

    private Map<String, String> buildBreadcrumbs(List<CatalogCategory> categories) {
        Map<String, String> map = new LinkedHashMap<>();
        for (CatalogCategory category : categories) {
            accumulateBreadcrumb(map, category, "");
        }
        return Map.copyOf(map);
    }

    private void accumulateBreadcrumb(Map<String, String> breadcrumbs,
                                      CatalogCategory category,
                                      String prefix) {
        String path = prefix.isEmpty() ? category.name() : prefix + " / " + category.name();
        breadcrumbs.put(category.id(), path);
        for (CatalogCategory child : category.children()) {
            accumulateBreadcrumb(breadcrumbs, child, path);
        }
    }
}

