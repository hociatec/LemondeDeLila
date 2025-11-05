package com.lemondedelila.client.api;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondedelila.client.api.dto.GameMetadataDto;
import com.lemondedelila.client.api.dto.LeaderboardDto;
import com.lemondedelila.client.api.dto.ScoreDto;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;

public class ApiClient {
    private final HttpClient httpClient;
    private final ObjectMapper mapper;
    private final String baseUrl;

    public ApiClient(String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
        this.mapper = new ObjectMapper();
    }

    public CompletableFuture<List<GameMetadataDto>> listGames() {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/games"))
                .GET()
                .timeout(Duration.ofSeconds(10))
                .build();

        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(HttpResponse::body)
                .thenApply(body -> {
                    try {
                        return mapper.readValue(body, new TypeReference<List<GameMetadataDto>>(){});
                    } catch (IOException e) {
                        throw new RuntimeException(e);
                    }
                });
    }

    public CompletableFuture<LeaderboardDto> getLeaderboard(String gameId) {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/games/" + gameId + "/leaderboard"))
                .GET()
                .timeout(Duration.ofSeconds(10))
                .build();
        return httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .thenApply(HttpResponse::body)
                .thenApply(body -> {
                    try {
                        return mapper.readValue(body, LeaderboardDto.class);
                    } catch (IOException e) {
                        throw new RuntimeException(e);
                    }
                });
    }

    public CompletableFuture<Void> submitScore(String gameId, ScoreDto score) {
        try {
            String json = mapper.writeValueAsString(score);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/api/games/" + gameId + "/scores"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .timeout(Duration.ofSeconds(10))
                    .build();
            return httpClient.sendAsync(request, HttpResponse.BodyHandlers.discarding())
                    .thenAccept(resp -> {
                        if (resp.statusCode() >= 400) {
                            throw new RuntimeException("Failed to submit score: " + resp.statusCode());
                        }
                    });
        } catch (IOException e) {
            CompletableFuture<Void> f = new CompletableFuture<>();
            f.completeExceptionally(e);
            return f;
        }
    }
}
