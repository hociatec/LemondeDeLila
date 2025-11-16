package com.lemondelila.client.catalogue.service;

import com.lemondelila.client.catalogue.model.CatalogCategory;
import com.lemondelila.client.catalogue.model.CatalogData;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.service.dto.CatalogApiResponse;
import com.lemondelila.client.catalogue.service.dto.CatalogCategoryDto;
import com.lemondelila.client.catalogue.service.dto.GameSummaryDto;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.rest.RestClient;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public final class GameCatalogService {

    private final RestClient restClient;
    private final TaskScheduler scheduler;
    private final ClientSession session;

    @Inject
    public GameCatalogService(RestClient restClient,
                              TaskScheduler scheduler,
                              ClientSession session) {
        this.restClient = restClient;
        this.scheduler = scheduler;
        this.session = session;
    }

    public CompletableFuture<CatalogData> fetchCatalog() {
        CompletableFuture<CatalogData> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                CatalogApiResponse response = restClient.get("catalog", buildAuthHeaders(), CatalogApiResponse.class);
                future.complete(toCatalogData(response));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.completeExceptionally(new IOException("Chargement interrompu", e));
            } catch (Exception e) {
                future.completeExceptionally(e);
            }
        });
        return future;
    }

    public CompletableFuture<List<GameSummary>> fetchGames() {
        return fetchCatalog().thenApply(CatalogData::games);
    }

    public CompletableFuture<List<GameSummary>> fetchGamesForCategory(String categoryId) {
        CompletableFuture<List<GameSummary>> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                String encoded = encodeCategoryId(categoryId);
                GameSummaryDto[] response = restClient.get(
                        "catalog/categories/" + encoded + "/games",
                        buildAuthHeaders(),
                        GameSummaryDto[].class
                );
                future.complete(toGameSummaries(response));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.completeExceptionally(new IOException("Chargement interrompu", e));
            } catch (Exception e) {
                future.completeExceptionally(e);
            }
        });
        return future;
    }

    private CatalogData toCatalogData(CatalogApiResponse response) throws IOException {
        if (response == null) {
            throw new IOException("Reponse catalogue invalide");
        }
        List<CatalogCategory> categories = toCategories(response.categories());
        List<GameSummary> games = toGameSummaries(response.games());
        return new CatalogData(categories, games);
    }

    private List<GameSummary> toGameSummaries(List<GameSummaryDto> dtos) throws IOException {
        if (dtos == null) {
            return List.of();
        }
        List<GameSummary> games = new ArrayList<>();
        for (GameSummaryDto dto : dtos) {
            games.add(toGameSummary(dto));
        }
        games.sort((a, b) -> a.name().compareToIgnoreCase(b.name()));
        return List.copyOf(games);
    }

    private List<GameSummary> toGameSummaries(GameSummaryDto[] dtos) throws IOException {
        if (dtos == null || dtos.length == 0) {
            return List.of();
        }
        List<GameSummary> games = new ArrayList<>(dtos.length);
        for (GameSummaryDto dto : dtos) {
            games.add(toGameSummary(dto));
        }
        games.sort((a, b) -> a.name().compareToIgnoreCase(b.name()));
        return List.copyOf(games);
    }

    private GameSummary toGameSummary(GameSummaryDto dto) throws IOException {
        if (dto == null || dto.code() == null || dto.code().isBlank() || dto.name() == null || dto.name().isBlank()) {
            throw new IOException("Jeu invalide");
        }
        List<String> categories = dto.categories() == null ? List.of() : List.copyOf(dto.categories());
        return new GameSummary(
                dto.code(),
                dto.name(),
                Math.max(1, dto.minPlayers()),
                Math.max(dto.minPlayers(), dto.maxPlayers()),
                dto.engine(),
                dto.summary(),
                dto.hasRules(),
                categories
        );
    }

    private List<CatalogCategory> toCategories(List<CatalogCategoryDto> dtos) throws IOException {
        if (dtos == null || dtos.isEmpty()) {
            return List.of();
        }
        List<CatalogCategory> categories = new ArrayList<>(dtos.size());
        for (CatalogCategoryDto dto : dtos) {
            categories.add(toCategory(dto));
        }
        categories.sort((a, b) -> a.name().compareToIgnoreCase(b.name()));
        return List.copyOf(categories);
    }

    private CatalogCategory toCategory(CatalogCategoryDto dto) throws IOException {
        if (dto == null || dto.id() == null || dto.id().isBlank() || dto.name() == null || dto.name().isBlank()) {
            throw new IOException("Categorie invalide");
        }
        List<CatalogCategory> children = toCategories(dto.children());
        return new CatalogCategory(dto.id(), dto.name(), children);
    }

    private Map<String, String> buildAuthHeaders() {
        Map<String, String> headers = new HashMap<>();
        session.authenticated().ifPresent(auth ->
                headers.put("Authorization", "Bearer " + auth.token()));
        return headers;
    }

    private String encodeCategoryId(String categoryId) {
        if (categoryId == null) {
            return "";
        }
        String encoded = URLEncoder.encode(categoryId, StandardCharsets.UTF_8);
        return encoded.replace("+", "%20");
    }
}


