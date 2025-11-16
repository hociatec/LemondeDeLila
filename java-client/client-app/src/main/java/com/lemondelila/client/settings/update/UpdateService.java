package com.lemondelila.client.settings.update;

import com.lemondelila.client.framework.core.config.ConfigurationService;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;

import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.file.Path;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public final class UpdateService {

    private final TaskScheduler scheduler;
    private final UpdateRemoteGateway remoteGateway;
    private final LocalUpdateInstaller installer;
    private final String currentVersion;

    @Inject
    public UpdateService(HttpClient httpClient,
                         com.fasterxml.jackson.databind.ObjectMapper objectMapper,
                         TaskScheduler scheduler,
                         ConfigurationService configurationService) {
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
        Objects.requireNonNull(configurationService, "configurationService");
        this.remoteGateway = new UpdateRemoteGateway(httpClient, objectMapper, configurationService);
        this.installer = new LocalUpdateInstaller();
        this.currentVersion = configurationService.get("app.version", "1.0.0-SNAPSHOT");
    }

    public String currentVersion() {
        return currentVersion;
    }

    public CompletableFuture<UpdateCheckResult> checkForUpdates() {
        CompletableFuture<UpdateCheckResult> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            try {
                UpdateCheckResult result = remoteGateway.fetchLatest(currentVersion);
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
            Path updatesDir = null;
            Path archive = null;
            Path extracted = null;
            try {
                updatesDir = installer.prepareUpdatesDirectory();
                archive = installer.createArchivePath(updatesDir);
                updateStatus(statusConsumer, "Téléchargement de la mise à jour...");
                remoteGateway.downloadArchive(result.downloadUrl(), archive);
                updateStatus(statusConsumer, "Extraction des fichiers...");
                extracted = installer.extractArchive(archive, updatesDir);
                Path payloadRoot = installer.detectPayloadRoot(extracted);
                updateStatus(statusConsumer, "Mise à jour des fichiers...");
                Path installRoot = installer.resolveRootDirectory();
                installer.copyPayload(payloadRoot, installRoot);
                updateStatus(statusConsumer, "Nettoyage...");
                installer.cleanup(archive, extracted);
                future.complete(null);
            } catch (IOException | InterruptedException ex) {
                if (ex instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                installer.cleanup(archive, extracted);
                future.completeExceptionally(ex);
            }
        });
        return future;
    }

    private void updateStatus(Consumer<String> consumer, String message) {
        if (consumer != null) {
            consumer.accept(message);
        }
    }
}
