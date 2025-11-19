package com.lemondelila.client.settings.update;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.core.config.ConfigurationService;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.util.Objects;

final class UpdateRemoteGateway {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final URI checkUri;

    UpdateRemoteGateway(HttpClient httpClient,
                        ObjectMapper objectMapper,
                        ConfigurationService configurationService) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        Objects.requireNonNull(configurationService, "configurationService");
        this.checkUri = URI.create(configurationService.get("updates.check.url", "https://hociatec.fr/client/version"));
    }

    UpdateCheckResult fetchLatest(String currentVersion) throws IOException, InterruptedException {
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
        String checksum = root.path("checksum").asText(null);
        boolean newer = isRemoteNewer(remoteVersion, currentVersion);
        return new UpdateCheckResult(currentVersion, remoteVersion, downloadUrl, notes, newer, checksum);
    }

    void downloadArchive(String url, Path destination) throws IOException, InterruptedException {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .GET()
                .timeout(Duration.ofMinutes(2))
                .build();
        HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() >= 400) {
            throw new IOException("HTTP " + response.statusCode() + " lors du téléchargement de la mise à jour.");
        }
        try (InputStream body = response.body()) {
            Files.copy(body, destination, StandardCopyOption.REPLACE_EXISTING);
        }
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
