package com.lemondelila.client.catalogue.presenter;

import com.lemondelila.client.catalogue.model.CatalogData;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.game.controller.GameCatalogController;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

/**
 * Service léger qui encapsule les chargements distants du catalogue.
 */
final class CatalogDataLoader {

    private final GameCatalogController controller;
    private final CatalogDataIndex dataIndex;
    private final Set<String> pendingCategoryLoads = new HashSet<>();

    private boolean loading;
    private boolean loaded;
    private CompletableFuture<Boolean> catalogFuture = CompletableFuture.completedFuture(false);

    CatalogDataLoader(GameCatalogController controller, CatalogDataIndex dataIndex) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.dataIndex = Objects.requireNonNull(dataIndex, "dataIndex");
    }

    CompletableFuture<Boolean> loadCatalog(boolean forceReload) {
        if (loading) {
            return catalogFuture;
        }
        if (loaded && !forceReload) {
            return CompletableFuture.completedFuture(false);
        }
        loading = true;
        catalogFuture = controller.loadCatalog()
                .thenApply(catalog -> {
                    applyCatalog(catalog);
                    return true;
                })
                .whenComplete((result, error) -> loading = false);
        return catalogFuture;
    }

    CompletableFuture<List<GameSummary>> loadGamesForCategory(String categoryId) {
        if (categoryId == null || pendingCategoryLoads.contains(categoryId)) {
            return CompletableFuture.completedFuture(List.of());
        }
        pendingCategoryLoads.add(categoryId);
        return controller.loadGamesForCategory(categoryId)
                .whenComplete((games, error) -> pendingCategoryLoads.remove(categoryId))
                .thenApply(games -> {
                    if (games == null || games.isEmpty()) {
                        return Collections.<GameSummary>emptyList();
                    }
                    dataIndex.registerRemoteGames(games);
                    return games;
                });
    }

    boolean isLoaded() {
        return loaded;
    }

    private void applyCatalog(CatalogData catalog) {
        if (catalog == null) {
            return;
        }
        dataIndex.load(catalog);
        loaded = true;
    }
}

