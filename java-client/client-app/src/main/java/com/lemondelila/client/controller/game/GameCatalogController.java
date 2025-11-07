package com.lemondelila.client.controller.game;

import com.lemondelila.client.model.catalogue.CatalogData;
import com.lemondelila.client.model.catalogue.GameSummary;
import com.lemondelila.client.service.catalogue.GameCatalogService;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

/**
 * Controleur charge de recuperer le catalogue de jeux et les fiches associees.
 */
public final class GameCatalogController {

    private final GameCatalogService catalogService;

    public GameCatalogController(GameCatalogService catalogService) {
        this.catalogService = Objects.requireNonNull(catalogService, "catalogService");
    }

    public CompletableFuture<CatalogData> loadCatalog() {
        return catalogService.fetchCatalog();
    }

    public CompletableFuture<List<GameSummary>> loadGames() {
        return catalogService.fetchGames();
    }
}
