package com.lemondelila.client.settings.update;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.core.config.ConfigurationService;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.task.TaskScheduler;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.PublicKey;
import java.security.Signature;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.security.spec.X509EncodedKeySpec;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public final class UpdateService {

    private static final String DOWNLOAD_HEADER = "X-Client-Update-Token";

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final TaskScheduler scheduler;
    private final URI checkUri;
    private final String currentVersion;
    private final Path configuredRoot;
    private final Path configRootFromFile;
    private final String downloadToken;
    private final Path signaturePublicKeyPath;
    private final String signatureAlgorithm;

    @Inject
    public UpdateService(HttpClient httpClient,
                         ObjectMapper objectMapper,
                         TaskScheduler scheduler,
                         ConfigurationService configurationService) {
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.scheduler = Objects.requireNonNull(scheduler, "scheduler");
        Objects.requireNonNull(configurationService, "configurationService");
        this.checkUri = URI.create(configurationService.get("updates.check.url", "https://api.lilas.hociatec.fr/client/version"));
        this.currentVersion = resolveVersion(configurationService);
        this.configuredRoot = configurationService.get("updates.root.dir")
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(value -> {
                    Path candidate = Path.of(value);
                    if (!candidate.isAbsolute()) {
                        candidate = Paths.get("").resolve(candidate).normalize();
                    }
                    return candidate;
                })
                .orElse(null);
        this.configRootFromFile = configurationService.getExternalConfigPath()
                .map(UpdateService::deriveRootFromConfig)
                .orElse(null);
        this.downloadToken = configurationService.get("updates.auth.token")
                .map(String::trim)
                .orElse("");
        this.signaturePublicKeyPath = configurationService.get("updates.signature.publicKey")
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(Paths::get)
                .map(Path::toAbsolutePath)
                .orElse(null);
        this.signatureAlgorithm = configurationService.get("updates.signature.algorithm", "SHA256withRSA");
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
            failed.completeExceptionally(new IllegalArgumentException("URL de telechargement indisponible."));
            return failed;
        }
        if (isDowngrade(result)) {
            CompletableFuture<Void> failed = new CompletableFuture<>();
            failed.completeExceptionally(new IllegalStateException("Downgrade interdit : version distante plus ancienne."));
            return failed;
        }
        if (isBlockedByMinVersion(result)) {
            CompletableFuture<Void> failed = new CompletableFuture<>();
            failed.completeExceptionally(new IllegalStateException("Version locale trop ancienne. Mise a jour obligatoire requise."));
            return failed;
        }
        CompletableFuture<Void> future = new CompletableFuture<>();
        scheduler.runAsync(() -> {
            Path root = null;
            Path updatesDir = null;
            Path archive = null;
            Path stagedDir = null;
            Path backupDir = null;
            Path logFile = null;
            try {
                root = resolveRootDirectory();
                updatesDir = Files.createDirectories(root.resolve("updates"));
                logFile = updatesDir.resolve("update.log");
                appendLog(logFile, "Debut mise a jour vers " + result.remoteVersion());
                archive = updatesDir.resolve("client-update-" + System.currentTimeMillis() + ".zip");
                updateStatus(statusConsumer, "Telechargement de la mise a jour...");
                downloadArchive(result, archive, statusConsumer);
                String archiveHash = computeSha256(archive);
                appendLog(logFile, "Archive telechargee SHA-256=" + archiveHash);
                if (result.checksum() != null && !archiveHash.equalsIgnoreCase(result.checksum())) {
                    throw new IOException("Checksum SHA-256 invalide. Attendu: " + result.checksum() + " Recu: " + archiveHash);
                }
                updateStatus(statusConsumer, "Verification de la signature...");
                verifySignatureIfNeeded(result, archive, updatesDir, logFile);
                updateStatus(statusConsumer, "Extraction des fichiers...");
                stagedDir = extractArchive(archive, updatesDir);
                Path payloadRoot = detectPayloadRoot(stagedDir);
                updateStatus(statusConsumer, "Application des fichiers...");
                backupDir = Files.createTempDirectory(updatesDir, "backup-");
                applyWithBackup(payloadRoot, root, backupDir);
                updateStatus(statusConsumer, "Nettoyage...");
                Files.deleteIfExists(archive);
                deleteRecursively(stagedDir);
                deleteRecursively(backupDir);
                appendLog(logFile, "Mise a jour appliquee avec succes.");
                future.complete(null);
            } catch (IOException | InterruptedException ex) {
                if (ex instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                appendLog(logFile, "Echec mise a jour : " + ex.getMessage());
                try {
                    rollback(backupDir, root);
                } catch (IOException rollbackError) {
                    appendLog(logFile, "Rollback impossible : " + rollbackError.getMessage());
                }
                future.completeExceptionally(ex);
            } finally {
                try {
                    if (archive != null) {
                        Files.deleteIfExists(archive);
                    }
                    deleteRecursively(stagedDir);
                    deleteRecursively(backupDir);
                } catch (IOException ignored) {
                }
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
            throw new IOException("HTTP " + response.statusCode() + " lors de la vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rification des mises ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  jour");
        }
        JsonNode root = objectMapper.readTree(response.body());
        String remoteVersion = root.path("version").asText("");
        String downloadUrl = root.path("downloadUrl").asText("");
        String notes = root.path("notes").asText("");
        String checksum = root.path("checksum").asText(null);
        String minSupportedVersion = root.path("minSupportedVersion").asText(null);
        String signatureUrl = root.path("signatureUrl").asText(null);
        String signature = root.path("signature").asText(null);
        List<ChangelogEntry> changelog = parseChangelog(root.path("changelog"));
        boolean requiresMinimum = minSupportedVersion != null && compareVersions(minSupportedVersion, currentVersion) > 0;
        boolean newer = isRemoteNewer(remoteVersion, currentVersion) || requiresMinimum;
        return new UpdateCheckResult(
                currentVersion,
                remoteVersion,
                downloadUrl,
                notes,
                newer,
                checksum,
                minSupportedVersion,
                signatureUrl,
                signature,
                changelog
        );
    }

    private List<ChangelogEntry> parseChangelog(JsonNode changelogNode) {
        if (changelogNode == null || !changelogNode.isArray()) {
            return List.of();
        }
        List<ChangelogEntry> entries = new ArrayList<>();
        for (JsonNode entry : changelogNode) {
            if (entry.isTextual()) {
                entries.add(new ChangelogEntry(null, List.of(entry.asText()), List.of(), null));
                continue;
            }
            String version = entry.path("version").asText(null);
            List<String> highlights = asStringList(entry.path("highlights"));
            List<String> fixes = asStringList(entry.path("fixes"));
            String notes = entry.path("notes").asText(null);
            entries.add(new ChangelogEntry(version, highlights, fixes, notes));
        }
        return entries;
    }

    private List<String> asStringList(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return List.of();
        }
        if (node.isTextual()) {
            return List.of(node.asText());
        }
        if (node.isArray()) {
            List<String> values = new ArrayList<>();
            for (JsonNode item : node) {
                if (item.isTextual()) {
                    values.add(item.asText());
                }
            }
            return values;
        }
        return List.of();
    }

    private boolean isBlockedByMinVersion(UpdateCheckResult result) {
        if (result == null || result.minSupportedVersion() == null) {
            return false;
        }
        return compareVersions(result.minSupportedVersion(), currentVersion) > 0;
    }

    private boolean isDowngrade(UpdateCheckResult result) {
        if (result == null || result.remoteVersion() == null) {
            return false;
        }
        return compareVersions(result.remoteVersion(), currentVersion) < 0;
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

    private static Path deriveRootFromConfig(Path configFile) {
        Path absolute = configFile.toAbsolutePath().normalize();
        Path parent = absolute.getParent();
        if (parent == null) {
            return absolute;
        }
        Path parentDirectory = parent;
        Path fileName = parentDirectory.getFileName();
        if (fileName != null && "config".equalsIgnoreCase(fileName.toString())) {
            Path rootCandidate = parentDirectory.getParent();
            if (rootCandidate != null) {
                return rootCandidate;
            }
        }
        return parentDirectory;
    }

    private Path resolveRootDirectory() throws IOException {
        if (configuredRoot != null) {
            if (Files.exists(configuredRoot)) {
                return configuredRoot;
            }
            throw new IOException("Le dossier configurÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© pour les mises ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  jour est introuvable : " + configuredRoot);
        }
        if (configRootFromFile != null && Files.exists(configRootFromFile)) {
            return configRootFromFile;
        }
        Path cwd = Paths.get("").toAbsolutePath();
        Path candidate = findRootCandidate(cwd);
        if (candidate != null) {
            return candidate;
        }
        return cwd;
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

    
    private void downloadArchive(UpdateCheckResult result, Path destination, Consumer<String> statusConsumer) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(result.downloadUrl()))
                .GET()
                .timeout(Duration.ofMinutes(5));
        if (!downloadToken.isBlank()) {
            builder.header(DOWNLOAD_HEADER, downloadToken);
        }
        HttpRequest request = builder.build();
        HttpResponse<InputStream> response = httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
        if (response.statusCode() >= 400) {
            throw new IOException("HTTP " + response.statusCode() + " lors du telechargement de la mise a jour.");
        }
        long totalBytes = response.headers().firstValueAsLong("Content-Length").orElse(-1);
        byte[] buffer = new byte[8192];
        long readTotal = 0;
        long lastPercent = -1;
        try (InputStream body = response.body();
             OutputStream output = Files.newOutputStream(destination, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING)) {
            int read;
            while ((read = body.read(buffer)) != -1) {
                if (read > 0) {
                    output.write(buffer, 0, read);
                    readTotal += read;
                    if (totalBytes > 0 && statusConsumer != null) {
                        long percent = (readTotal * 100) / totalBytes;
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            updateStatus(statusConsumer, "Telechargement... " + percent + "%");
                        }
                    }
                }
            }
        }
    }

private Path extractArchive(Path archive, Path updatesDir) throws IOException {
        Path tempDir = Files.createTempDirectory(updatesDir, "extract-");
        try (ZipInputStream zipInputStream = new ZipInputStream(Files.newInputStream(archive))) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                Path target = tempDir.resolve(entry.getName()).normalize();
                if (!target.startsWith(tempDir)) {
                    throw new IOException("Archive corrompue : tentative d'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©criture hors dossier cible.");
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

    private void applyWithBackup(Path sourceRoot, Path targetRoot, Path backupRoot) throws IOException {
        Files.walkFileTree(sourceRoot, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                Path relative = sourceRoot.relativize(dir);
                if (relative.startsWith("updates")) {
                    return FileVisitResult.SKIP_SUBTREE;
                }
                Path targetDir = targetRoot.resolve(relative);
                Files.createDirectories(targetDir);
                Path backupDir = backupRoot.resolve(relative);
                Files.createDirectories(backupDir);
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                Path relative = sourceRoot.relativize(file);
                if (relative.startsWith("updates")) {
                    return FileVisitResult.CONTINUE;
                }
                Path targetFile = targetRoot.resolve(relative);
                Path backupFile = backupRoot.resolve(relative);
                if (Files.exists(targetFile)) {
                    Files.createDirectories(backupFile.getParent());
                    Files.copy(targetFile, backupFile, StandardCopyOption.REPLACE_EXISTING);
                }
                Files.createDirectories(targetFile.getParent());
                Files.copy(file, targetFile, StandardCopyOption.REPLACE_EXISTING);
                return FileVisitResult.CONTINUE;
            }
        });
    }

    private void rollback(Path backupRoot, Path targetRoot) throws IOException {
        if (backupRoot == null || targetRoot == null || !Files.exists(backupRoot)) {
            return;
        }
        copyRecursively(backupRoot, targetRoot);
    }


    private void verifySignatureIfNeeded(UpdateCheckResult result, Path archive, Path updatesDir, Path logFile) throws IOException, InterruptedException {
        boolean hasSignature = (result.signature() != null && !result.signature().isBlank())
                || (result.signatureUrl() != null && !result.signatureUrl().isBlank());
        if (!hasSignature) {
            appendLog(logFile, "Aucune signature fournie dans le manifest.");
            return;
        }
        if (signaturePublicKeyPath == null || !Files.exists(signaturePublicKeyPath)) {
            throw new IOException("Signature presente mais aucune cle publique configuree (updates.signature.publicKey).");
        }
        byte[] signatureBytes = result.signature() != null
                ? Base64.getDecoder().decode(result.signature())
                : downloadSignature(result.signatureUrl());
        PublicKey publicKey = loadPublicKey(signaturePublicKeyPath);
        Signature verifier;
        try {
            verifier = Signature.getInstance(signatureAlgorithm);
            verifier.initVerify(publicKey);
        } catch (Exception ex) {
            throw new IOException("Impossible d'initialiser la verification de signature", ex);
        }
        byte[] buffer = new byte[8192];
        try (InputStream in = Files.newInputStream(archive)) {
            int read;
            while ((read = in.read(buffer)) != -1) {
                if (read > 0) {
                    verifier.update(buffer, 0, read);
                }
            }
        } catch (Exception ex) {
            throw new IOException("Lecture de l'archive pendant la verification de signature impossible", ex);
        }
        try {
            if (!verifier.verify(signatureBytes)) {
                throw new IOException("Signature de l'archive invalide.");
            }
        } catch (Exception ex) {
            throw new IOException("Echec verification signature", ex);
        }
        appendLog(logFile, "Signature valide (" + signatureAlgorithm + ").");
    }

    private byte[] downloadSignature(String signatureUrl) throws IOException, InterruptedException {
        if (signatureUrl == null || signatureUrl.isBlank()) {
            throw new IOException("URL de signature manquante dans le manifest.");
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(signatureUrl))
                .GET()
                .timeout(Duration.ofSeconds(30))
                .build();
        HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() >= 400) {
            throw new IOException("HTTP " + response.statusCode() + " lors du telechargement de la signature.");
        }
        byte[] body = response.body();
        if (body == null || body.length == 0) {
            throw new IOException("Signature vide telechargee.");
        }
        return body;
    }

    private PublicKey loadPublicKey(Path path) throws IOException {
        byte[] content = Files.readAllBytes(path);
        String asString = new String(content, StandardCharsets.US_ASCII);
        try {
            if (asString.contains("BEGIN CERTIFICATE")) {
                CertificateFactory cf = CertificateFactory.getInstance("X.509");
                try (InputStream in = new ByteArrayInputStream(content)) {
                    X509Certificate certificate = (X509Certificate) cf.generateCertificate(in);
                    return certificate.getPublicKey();
                }
            }
            String cleaned = asString
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\s", "");
            byte[] keyBytes = cleaned.equals(asString) ? content : Base64.getDecoder().decode(cleaned);
            X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
            return KeyFactory.getInstance("RSA").generatePublic(spec);
        } catch (Exception ex) {
            throw new IOException("Impossible de charger la cle publique pour la signature", ex);
        }
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

    private String computeSha256(Path file) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[8192];
            try (InputStream inputStream = Files.newInputStream(file)) {
                int read;
                while ((read = inputStream.read(buffer)) != -1) {
                    if (read > 0) {
                        digest.update(buffer, 0, read);
                    }
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException ex) {
            throw new IOException("Algorithme SHA-256 indisponible", ex);
        }
    }

    private void appendLog(Path logFile, String message) {
        if (logFile == null || message == null) {
            return;
        }
        String line = "[" + Instant.now() + "] " + message + System.lineSeparator();
        try {
            Files.createDirectories(logFile.getParent());
            Files.writeString(logFile, line, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException ignored) {
        }
    }
}
