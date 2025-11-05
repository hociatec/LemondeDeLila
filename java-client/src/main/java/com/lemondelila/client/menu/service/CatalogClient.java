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
            return parseCategories(new JSONArray(response.body()));
        }
        throw new IOException(String.format(Locale.ROOT, "Erreur HTTP %d lors de la recuperation des categories", response.statusCode()));
    }

    private static List<CategorySummary> parseCategories(JSONArray jsonArray) {
        List<CategorySummary> categories = new ArrayList<>();
        for (int i = 0; i < jsonArray.length(); i++) {
            JSONObject categoryJson = jsonArray.getJSONObject(i);
            String name = categoryJson.getString("name");
            List<CategorySummary> subCategories = new ArrayList<>();
            List<GameSummary> games = new ArrayList<>();
            if (categoryJson.has("children")) {
                JSONArray children = categoryJson.getJSONArray("children");
                for (int j = 0; j < children.length(); j++) {
                    JSONObject child = children.getJSONObject(j);
                    if (child.has("children")) {
                        subCategories.add(parseCategory(child));
                    } else {
                        games.add(new GameSummary(child.getString("name")));
                    }
                }
            }
            categories.add(new CategorySummary(name, subCategories, games));
        }
        return categories;
    }

    private static CategorySummary parseCategory(JSONObject jsonObject) {
        String name = jsonObject.getString("name");
        List<CategorySummary> subCategories = new ArrayList<>();
        List<GameSummary> games = new ArrayList<>();
        if (jsonObject.has("children")) {
            JSONArray children = jsonObject.getJSONArray("children");
            for (int i = 0; i < children.length(); i++) {
                JSONObject child = children.getJSONObject(i);
                if (child.has("children")) {
                    subCategories.add(parseCategory(child));
                } else {
                    games.add(new GameSummary(child.getString("name")));
                }
            }
        }
        return new CategorySummary(name, subCategories, games);
    }
}
