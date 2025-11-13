package com.lemondelila.client.catalogue.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.catalogue.model.CatalogCategory;
import com.lemondelila.client.catalogue.model.CatalogData;
import com.lemondelila.client.catalogue.model.GameSummary;
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
                JsonNode response = restClient.get("catalog", buildAuthHeaders());
                CatalogData catalog = parseCatalog(response);
                future.complete(catalog);
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
                JsonNode response = restClient.get("catalog/categories/" + encoded + "/games", buildAuthHeaders());
                List<GameSummary> games = parseGames(response);
                future.complete(games);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                future.completeExceptionally(new IOException("Chargement interrompu", e));
            } catch (Exception e) {
                future.completeExceptionally(e);
            }
        });
        return future;
    }

    private CatalogData parseCatalog(JsonNode response) throws IOException {
        if (response == null || !response.isObject()) {
            throw new IOException("Reponse catalogue invalide");
        }
        List<CatalogCategory> categories = parseCategories(response.path("categories"));
        List<GameSummary> games = parseGames(response.path("games"));
        return new CatalogData(categories, games);
    }

    private List<GameSummary> parseGames(JsonNode gamesNode) throws IOException {
        if (!gamesNode.isArray()) {
            throw new IOException("Liste des jeux invalide");
        }

        List<GameSummary> games = new ArrayList<>();
        for (JsonNode node : gamesNode) {
            String code = node.path("code").asText(null);
            String name = node.path("name").asText(null);
            if (code == null || name == null) {
                continue;
            }
            int minPlayers = node.path("minPlayers").asInt(1);
            int maxPlayers = node.path("maxPlayers").asInt(Math.max(1, minPlayers));
            String engine = node.path("engine").asText(null);
            String summary = node.hasNonNull("summary") ? node.get("summary").asText() : null;
            boolean hasRules = node.path("hasRules").asBoolean(false);

            List<String> categories = new ArrayList<>();
            JsonNode categoriesNode = node.path("categories");
            if (categoriesNode.isArray()) {
                for (JsonNode cat : categoriesNode) {
                    if (cat.isTextual()) {
                        categories.add(cat.asText());
                    }
                }
            }

            games.add(new GameSummary(
                    code,
                    name,
                    minPlayers,
                    maxPlayers,
                    engine,
                    summary,
                    hasRules,
                    List.copyOf(categories)
            ));
        }

        games.sort((a, b) -> a.name().compareToIgnoreCase(b.name()));
        return List.copyOf(games);
    }

    private List<CatalogCategory> parseCategories(JsonNode node) throws IOException {
        if (node.isMissingNode() || node.isNull()) {
            return List.of();
        }
        if (!node.isArray()) {
            throw new IOException("Liste des categories invalide");
        }

        List<CatalogCategory> categories = new ArrayList<>();
        for (JsonNode categoryNode : node) {
            CatalogCategory category = parseCategory(categoryNode);
            if (category != null) {
                categories.add(category);
            }
        }
        categories.sort((a, b) -> a.name().compareToIgnoreCase(b.name()));
        return List.copyOf(categories);
    }

    private CatalogCategory parseCategory(JsonNode node) throws IOException {
        if (!node.isObject()) {
            throw new IOException("Categorie invalide");
        }
        String id = node.path("id").asText(null);
        String name = node.path("name").asText(null);
        if (id == null || name == null) {
            throw new IOException("Categorie incomplete");
        }

        List<CatalogCategory> children = parseCategories(node.path("children"));
        return new CatalogCategory(id, name, children);
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


