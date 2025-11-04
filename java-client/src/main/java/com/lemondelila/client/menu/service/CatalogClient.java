package com.lemondelila.client.menu.service;

import com.lemondelila.client.menu.model.CategorySummary;
import com.lemondelila.client.menu.model.GameSummary;
import org.json.JSONArray;
import org.json.JSONException;
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

    private static List<CategorySummary> parseCategories(String json) {
        List<CategorySummary> categories = new ArrayList<>();
        if (json == null || json.isBlank()) {
            return categories;
        }
        try {
            JSONArray jsonArray = new JSONArray(json);
            for (int i = 0; i < jsonArray.length(); i++) {
                JSONObject categoryJson = jsonArray.getJSONObject(i);
                String name = categoryJson.getString("name");
                JSONArray subCategoriesJson = categoryJson.optJSONArray("subCategories");
                List<CategorySummary> subCategories = new ArrayList<>();
                if (subCategoriesJson != null) {
                    for (int j = 0; j < subCategoriesJson.length(); j++) {
                        JSONObject subCategoryJson = subCategoriesJson.getJSONObject(j);
                        String subCategoryName = subCategoryJson.getString("name");
                        JSONArray gamesJson = subCategoryJson.optJSONArray("games");
                        List<GameSummary> games = new ArrayList<>();
                        if (gamesJson != null) {
                            for (int k = 0; k < gamesJson.length(); k++) {
                                JSONObject gameJson = gamesJson.getJSONObject(k);
                                String gameName = gameJson.getString("name");
                                games.add(new GameSummary(gameName));
                            }
                        }
                        subCategories.add(new CategorySummary(subCategoryName, new ArrayList<>(), games));
                    }
                }
                categories.add(new CategorySummary(name, subCategories, new ArrayList<>()));
            }
        } catch (JSONException e) {
            System.err.println("Error parsing categories JSON: " + e.getMessage());
        }
        return categories;
    }
}
