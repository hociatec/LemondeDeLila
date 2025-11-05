package com.lemondelila.client.menu.service;

import com.lemondelila.client.menu.model.CategorySummary;
import com.lemondelila.client.menu.model.Game;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Client HTTP pour recuperer les categories de jeux.
 */
public final class CatalogClient {

    private final HttpClient httpClient;
    private final URI categoriesUri;

    public CatalogClient(URI categoriesUri) {
        this.categoriesUri = Objects.requireNonNull(categoriesUri, "categoriesUri");
        this.httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    public List<CategorySummary> fetchCategories(String token) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(categoriesUri)
                .timeout(Duration.ofSeconds(10))
                .header("Accept", "application/json");
        if (token != null && !token.isBlank()) {
            builder.header("Authorization", "Bearer " + token.trim());
        }
        HttpRequest request = builder.GET().build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        if (response.statusCode() >= 200 && response.statusCode() < 300) {
            return parseCategories(response.body());
        }
        throw new IOException(String.format(Locale.ROOT, "Erreur HTTP %d lors de la recuperation des categories", response.statusCode()));
    }

    private List<CategorySummary> parseCategories(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        JSONObject root = new JSONObject(json);
        JSONArray categoriesArray = root.getJSONArray("categories");
        return parseCategoryArray(categoriesArray);
    }

    private List<CategorySummary> parseCategoryArray(JSONArray categoriesArray) {
        List<CategorySummary> categories = new ArrayList<>();
        for (int i = 0; i < categoriesArray.length(); i++) {
            JSONObject categoryObject = categoriesArray.getJSONObject(i);
            String id = categoryObject.getString("id");
            String name = categoryObject.getString("name");
            List<CategorySummary> children = new ArrayList<>();
            if (categoryObject.has("children")) {
                children = parseCategoryArray(categoryObject.getJSONArray("children"));
            }
            List<Game> games = new ArrayList<>();
            if (categoryObject.has("games")) {
                JSONArray gamesArray = categoryObject.getJSONArray("games");
                for (int j = 0; j < gamesArray.length(); j++) {
                    JSONObject gameObject = gamesArray.getJSONObject(j);
                    String gameId = gameObject.getString("id");
                    String gameName = gameObject.getString("name");
                    int minPlayers = gameObject.getInt("minPlayers");
                    int maxPlayers = gameObject.getInt("maxPlayers");
                    games.add(new Game(gameId, gameName, minPlayers, maxPlayers));
                }
            }
            categories.add(new CategorySummary(id, name, children, games));
        }
        return categories;
    }
}
