package com.lemondelila.client.catalogue.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;
import com.lemondelila.client.framework.network.config.NetworkEndpoints;
import com.lemondelila.client.user.model.ClientSession;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

/**
 * Fetches game rules from the backend and exposes the content as plain text.
 * The service is resilient to multiple identifier formats (code or engine) and
 * gracefully handles both JSON and text payloads.
 */
public final class GameRulesService {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final TaskScheduler scheduler;
    private final ClientSession session;
    private final URI baseUri;

    @Inject
    public GameRulesService(HttpClient httpClient,
                            ObjectMapper objectMapper,
                            TaskScheduler scheduler,
                            NetworkEndpoints endpoints,
                            ClientSession session) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
        this.session = Objects.requireNonNull(session, "session");
        this.baseUri = endpoints.httpBase();
    }

    public CompletableFuture<String> fetchRules(GameSummary game) {
        Objects.requireNonNull(game, "game");
        List<String> candidates = new ArrayList<>();
        if (game.code() != null && !game.code().isBlank()) {
            candidates.add(game.code());
        }
        if (game.engine() != null && !game.engine().isBlank() && !candidates.contains(game.engine())) {
            candidates.add(game.engine());
        }
        if (candidates.isEmpty()) {
            CompletableFuture<String> failed = new CompletableFuture<>();
            failed.completeExceptionally(new IllegalArgumentException("No identifier available to fetch rules"));
            return failed;
        }

        CompletableFuture<String> future = new CompletableFuture<>();
        scheduler.runAsync(() -> attemptFetchSequential(game, candidates, future));
        return future;
    }

    private void attemptFetchSequential(GameSummary game,
                                        List<String> candidates,
                                        CompletableFuture<String> future) {
        IOException lastError = null;
        for (String candidate : candidates) {
            if (future.isDone()) {
                return;
            }
            try {
                String content = fetchRulesFor(candidate);
                future.complete(content);
                return;
            } catch (IOException | InterruptedException ex) {
                if (ex instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                lastError = ex instanceof IOException
                        ? (IOException) ex
                        : new IOException("Rules fetch interrupted", ex);
            }
        }
        if (lastError == null) {
            lastError = new IOException("Rules not found for " + game.name());
        }
        future.completeExceptionally(lastError);
    }

    private String fetchRulesFor(String identifier) throws IOException, InterruptedException {
        String encoded = URLEncoder.encode(identifier, StandardCharsets.UTF_8);
        URI target = baseUri.resolve("games/" + encoded + "/rules");
        HttpRequest.Builder builder = HttpRequest.newBuilder(target)
                .GET()
                .timeout(Duration.ofSeconds(10));
        session.authenticated().ifPresent(auth ->
                builder.header("Authorization", "Bearer " + auth.token()));
        HttpRequest request = builder.build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IOException("HTTP " + response.statusCode() + " while fetching rules for " + identifier);
        }
        return normaliseResponseBody(response);
    }

    private String normaliseResponseBody(HttpResponse<String> response) throws IOException {
        String body = response.body();
        if (body == null) {
            return "";
        }
        String contentType = response.headers()
                .firstValue("Content-Type")
                .orElse("")
                .toLowerCase();

        if (contentType.contains("application/json")) {
            return extractFromJson(body);
        }
        return body;
    }

    private String extractFromJson(String body) throws IOException {
        JsonNode root = objectMapper.readTree(body);
        if (root == null) {
            return "";
        }
        JsonNode rulesNode = root.path("data");
        if (rulesNode.isMissingNode() || rulesNode.isNull()) {
            rulesNode = root.path("rules");
        }
        if (rulesNode.isTextual()) {
            return rulesNode.asText();
        }
        if (rulesNode.isArray()) {
            StringBuilder builder = new StringBuilder();
            for (JsonNode node : rulesNode) {
                if (node.isTextual()) {
                    builder.append(node.asText());
                } else if (node.isObject() && node.has("text")) {
                    builder.append(node.get("text").asText());
                } else {
                    builder.append(node.toString());
                }
                builder.append(System.lineSeparator()).append(System.lineSeparator());
            }
            return builder.toString().strip();
        }
        if (rulesNode.isObject() && rulesNode.has("text")) {
            return rulesNode.get("text").asText();
        }
        return body;
    }
}

