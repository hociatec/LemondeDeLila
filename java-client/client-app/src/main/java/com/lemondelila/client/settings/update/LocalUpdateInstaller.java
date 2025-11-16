package com.lemondelila.client.settings.update;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

final class LocalUpdateInstaller {

    LocalUpdateInstaller() {
    }

    Path prepareUpdatesDirectory() throws IOException {
        Path root = resolveRootDirectory();
        return Files.createDirectories(root.resolve("updates"));
    }

    Path createArchivePath(Path updatesDir) {
        return updatesDir.resolve("client-update-" + System.currentTimeMillis() + ".zip");
    }

    Path extractArchive(Path archive, Path updatesDir) throws IOException {
        Path tempDir = Files.createTempDirectory(updatesDir, "extract-");
        try (ZipInputStream zipInputStream = new ZipInputStream(Files.newInputStream(archive))) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                Path resolved = tempDir.resolve(entry.getName()).normalize();
                if (!resolved.startsWith(tempDir)) {
                    throw new IOException("Entrée invalide dans l'archive : " + entry.getName());
                }
                if (entry.isDirectory()) {
                    Files.createDirectories(resolved);
                } else {
                    Files.createDirectories(resolved.getParent());
                    Files.copy(zipInputStream, resolved, StandardCopyOption.REPLACE_EXISTING);
                }
            }
        }
        return tempDir;
    }

    Path detectPayloadRoot(Path extractedRoot) throws IOException {
        try (var stream = Files.list(extractedRoot)) {
            Path singleChild = stream.filter(Files::isDirectory)
                    .findFirst()
                    .orElse(extractedRoot);
            return singleChild;
        }
    }

    void copyPayload(Path payloadRoot, Path targetRoot) throws IOException {
        Files.walkFileTree(payloadRoot, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                Path relative = payloadRoot.relativize(dir);
                Files.createDirectories(targetRoot.resolve(relative));
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                Path relative = payloadRoot.relativize(file);
                Files.copy(file, targetRoot.resolve(relative), StandardCopyOption.REPLACE_EXISTING);
                return FileVisitResult.CONTINUE;
            }
        });
    }

    void cleanup(Path archive, Path tempDir) {
        try {
            Files.deleteIfExists(archive);
        } catch (IOException ignored) {
        }
        if (tempDir == null) {
            return;
        }
        try {
            deleteRecursively(tempDir);
        } catch (IOException ignored) {
        }
    }

    Path resolveRootDirectory() throws IOException {
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

    private void deleteRecursively(Path directory) throws IOException {
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
}
