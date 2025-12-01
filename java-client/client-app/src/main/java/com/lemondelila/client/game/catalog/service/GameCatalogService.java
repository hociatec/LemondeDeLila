package com.lemondelila.client.game.catalog.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.network.rest.RestClient;
import com.lemondelila.client.game.catalog.model.CatalogCategory;
import com.lemondelila.client.game.catalog.model.CatalogGame;
import com.lemondelila.client.game.catalog.model.CatalogPayload;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

public final class GameCatalogService {

    private final RestClient restClient;

    public GameCatalogService(RestClient restClient) {
        this.restClient = restClient;
    }

    public CatalogPayload fetchAll() throws IOException, InterruptedException {
        JsonNode json = restClient.get("catalog");
        List<CatalogCategory> categories = parseCategories(json.path("categories"));
        List<CatalogGame> games = parseGames(json.path("games"));
        return new CatalogPayload(categories, games);
    }

    public List<CatalogGame> fetchGames() throws IOException, InterruptedException {
        JsonNode json = restClient.get("catalog/games");
        return parseGames(json);
    }

    public List<CatalogCategory> fetchCategories() throws IOException, InterruptedException {
        JsonNode json = restClient.get("catalog/categories");
        return parseCategories(json);
    }

    public List<CatalogGame> fetchGamesForCategory(String categoryId) throws IOException, InterruptedException {
        JsonNode json = restClient.get("catalog/categories/" + encode(categoryId) + "/games");
        return parseGames(json);
    }

    private List<CatalogGame> parseGames(JsonNode node) {
        if (!node.isArray()) {
            return Collections.emptyList();
        }
        List<CatalogGame> games = new ArrayList<>();
        for (JsonNode g : node) {
            String code = g.path("code").asText(g.path("id").asText(""));
            if (code.isBlank()) {
                continue;
            }
            String name = g.path("name").asText("");
            String summary = g.path("summary").asText("");
            int min = g.path("minPlayers").asInt(0);
            int max = g.path("maxPlayers").asInt(0);
            String engine = g.path("engine").asText("");
            List<String> categories = new ArrayList<>();
            if (g.path("categories").isArray()) {
                g.path("categories").forEach(c -> categories.add(c.asText("")));
            }
            games.add(new CatalogGame(code, name, summary, min, max, engine, categories));
        }
        return games;
    }

    private List<CatalogCategory> parseCategories(JsonNode node) {
        if (!node.isArray()) {
            return Collections.emptyList();
        }
        List<CatalogCategory> list = new ArrayList<>();
        for (JsonNode c : node) {
            String id = c.path("id").asText("");
            if (id.isBlank()) {
                continue;
            }
            String name = c.path("name").asText("");
            List<CatalogCategory> children = parseCategories(c.path("children"));
            list.add(new CatalogCategory(id, name, children));
        }
        return list;
    }

    private String encode(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8);
    }
}
