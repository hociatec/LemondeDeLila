package com.lemondelila.client.menu.service;

import com.lemondelila.client.menu.model.CategorySummary;
import org.json.JSONArray;
import org.json.JSONException;

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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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

    private static List<CategorySummary> parseCategories(String json) {
        List<CategorySummary> categories = new ArrayList<>();
        if (json == null || json.isBlank()) {
            return categories;
        }
        try {
            JSONArray jsonArray = new JSONArray(json);
            for (int i = 0; i < jsonArray.length(); i++) {
                categories.add(new CategorySummary(jsonArray.getString(i)));
            }
        } catch (JSONException e) {
            // Log the error or handle it as needed
            System.err.println("Error parsing categories JSON: " + e.getMessage());
        }
        return categories;
    }
}
