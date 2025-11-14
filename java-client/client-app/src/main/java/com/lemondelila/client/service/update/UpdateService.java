package com.lemondelila.client.service.update;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.framework.core.config.ConfigurationService;
import com.lemondelila.framework.core.task.TaskScheduler;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

public final class UpdateService {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final TaskScheduler scheduler;
    private final URI checkUri;
    private final String currentVersion;

    public UpdateService(HttpClient httpClient,
                         ObjectMapper objectMapper,
                         TaskScheduler scheduler,
                         ConfigurationService configurationService) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
        Objects.requireNonNull(configurationService, "configurationService");
        this.checkUri = URI.create(configurationService.get("updates.check.url", "https://hociatec.fr/api/client/version"));
        this.currentVersion = resolveVersion(configurationService);
    }

    public String currentVersion() {
        return currentVersion;
    }

    public CompletableFuture<UpdateCheckResult> checkForUpdates() {
        CompletableFuture<UpdateCheckResult> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                UpdateCheckResult result = fetchLatest();
                future.complete(result);
            } catch (IOException | InterruptedException ex) {
                if (ex instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                future.completeExceptionally(ex);
            }
        });
        return future;
    }

    private UpdateCheckResult fetchLatest() throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(checkUri)
                .GET()
                .timeout(Duration.ofSeconds(10))
                .build();
        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 400) {
            throw new IOException("HTTP " + response.statusCode() + " lors de la vérification des mises à jour");
        }
        JsonNode root = objectMapper.readTree(response.body());
        String remoteVersion = root.path("version").asText("");
        String downloadUrl = root.path("downloadUrl").asText("");
        String notes = root.path("notes").asText("");
        boolean newer = isRemoteNewer(remoteVersion, currentVersion);
        return new UpdateCheckResult(currentVersion, remoteVersion, downloadUrl, notes, newer);
    }

    private String resolveVersion(ConfigurationService configurationService) {
        String manifestVersion = UpdateService.class.getPackage().getImplementationVersion();
        if (manifestVersion != null && !manifestVersion.isBlank()) {
            return manifestVersion;
        }
        return configurationService.get("app.version", "1.0.0-SNAPSHOT");
    }

    private boolean isRemoteNewer(String remote, String local) {
        if (remote == null || remote.isBlank()) {
            return false;
        }
        if (local == null || local.isBlank()) {
            return true;
        }
        return compareVersions(remote, local) > 0;
    }

    private int compareVersions(String left, String right) {
        String[] leftParts = left.split("[\\.\\-]");
        String[] rightParts = right.split("[\\.\\-]");
        int length = Math.max(leftParts.length, rightParts.length);
        for (int i = 0; i < length; i++) {
            int leftValue = i < leftParts.length ? parsePart(leftParts[i]) : 0;
            int rightValue = i < rightParts.length ? parsePart(rightParts[i]) : 0;
            if (leftValue != rightValue) {
                return Integer.compare(leftValue, rightValue);
            }
        }
        return 0;
    }

    private int parsePart(String part) {
        try {
            return Integer.parseInt(part.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException ex) {
            return 0;
        }
    }
}
