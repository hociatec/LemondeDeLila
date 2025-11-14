package com.lemondelila.client.service.update;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.framework.core.config.ConfigurationService;
import com.lemondelila.framework.core.task.TaskScheduler;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

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

    public CompletableFuture<Void> downloadAndInstall(UpdateCheckResult result, Consumer<String> statusConsumer) {
        Objects.requireNonNull(result, "result");
        if (result.downloadUrl() == null || result.downloadUrl().isBlank()) {
            CompletableFuture<Void> failed = new CompletableFuture<>();
            failed.completeExceptionally(new IllegalArgumentException("URL de téléchargement indisponible."));
            return failed;
        }
        CompletableFuture<Void> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                Path root = resolveRootDirectory();
                Path updatesDir = Files.createDirectories(root.resolve("updates"));
                Path archive = updatesDir.resolve("client-update-" + System.currentTimeMillis() + ".zip");
                updateStatus(statusConsumer, "Téléchargement de la mise à jour...");
                downloadArchive(result.downloadUrl(), archive);
                updateStatus(statusConsumer, "Extraction des fichiers...");
                Path tempDir = extractArchive(archive, updatesDir);
                Path payloadRoot = detectPayloadRoot(tempDir);
                updateStatus(statusConsumer, "Copie sur " + root + " ...");
                copyRecursively(payloadRoot, root);
                updateStatus(statusConsumer, "Nettoyage...");
                Files.deleteIfExists(archive);
                deleteRecursively(tempDir);
                future.complete(null);
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

    private Path resolveRootDirectory() throws IOException {
        Path cwd = Paths.get("").toAbsolutePath();
        Path candidate = findRootCandidate(cwd);
        if (candidate != null) {
            return candidate;
        }
        throw new IOException("Impossible de localiser le dossier du projet (start-lila.ps1 introuvable).");
    }

    private Path findRootCandidate(Path start) {
        Path current = start;
        int depth = 0;
        while (current != null && depth < 4) {
            if (Files.exists(current.resolve("start-lila.ps1"))) {
                return current;
            }
            current = current.getParent();
            depth++;
        }
        return null;
    }

    private void downloadArchive(String url, Path destination) throws IOException, InterruptedException {
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

    private Path extractArchive(Path archive, Path updatesDir) throws IOException {
        Path tempDir = Files.createTempDirectory(updatesDir, "extract-");
        try (ZipInputStream zipInputStream = new ZipInputStream(Files.newInputStream(archive))) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                Path target = tempDir.resolve(entry.getName()).normalize();
                if (!target.startsWith(tempDir)) {
                    throw new IOException("Archive corrompue : tentative d'écriture hors dossier cible.");
                }
                if (entry.isDirectory()) {
                    Files.createDirectories(target);
                } else {
                    Files.createDirectories(target.getParent());
                    Files.copy(zipInputStream, target, StandardCopyOption.REPLACE_EXISTING);
                }
                zipInputStream.closeEntry();
            }
        }
        return tempDir;
    }

    private Path detectPayloadRoot(Path tempDir) throws IOException {
        try (var stream = Files.list(tempDir)) {
            var entries = stream.filter(Files::exists).toList();
            if (entries.size() == 1 && Files.isDirectory(entries.get(0))) {
                return entries.get(0);
            }
        }
        return tempDir;
    }

    private void copyRecursively(Path sourceRoot, Path targetRoot) throws IOException {
        Files.walkFileTree(sourceRoot, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                Path relative = sourceRoot.relativize(dir);
                Path targetDir = targetRoot.resolve(relative);
                Files.createDirectories(targetDir);
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                Path relative = sourceRoot.relativize(file);
                Path targetFile = targetRoot.resolve(relative);
                Files.createDirectories(targetFile.getParent());
                Files.copy(file, targetFile, StandardCopyOption.REPLACE_EXISTING);
                return FileVisitResult.CONTINUE;
            }
        });
    }

    private void deleteRecursively(Path directory) throws IOException {
        if (directory == null || !Files.exists(directory)) {
            return;
        }
        Files.walkFileTree(directory, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                Files.deleteIfExists(file);
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                Files.deleteIfExists(dir);
                return FileVisitResult.CONTINUE;
            }
        });
    }

    private void updateStatus(Consumer<String> consumer, String message) {
        if (consumer != null) {
            consumer.accept(message);
        }
    }
}
