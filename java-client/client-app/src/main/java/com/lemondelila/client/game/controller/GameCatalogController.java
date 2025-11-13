package com.lemondelila.client.game.controller;

import com.lemondelila.client.catalogue.model.CatalogData;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.service.GameCatalogService;
import com.lemondelila.client.framework.core.di.Inject;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

/**
 * Controleur charge de recuperer le catalogue de jeux et les fiches associees.
 */
public final class GameCatalogController {

    private final GameCatalogService catalogService;

    @Inject
    public GameCatalogController(GameCatalogService catalogService) {
        this.catalogService = Objects.requireNonNull(catalogService, "catalogService");
    }

    public CompletableFuture<CatalogData> loadCatalog() {
        return catalogService.fetchCatalog();
    }

    public CompletableFuture<List<GameSummary>> loadGames() {
        return catalogService.fetchGames();
    }

    public CompletableFuture<List<GameSummary>> loadGamesForCategory(String categoryId) {
        return catalogService.fetchGamesForCategory(categoryId);
    }
}
