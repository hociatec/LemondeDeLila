package com.lemondelila.client.security;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;

class EncryptedSessionVaultTest {

    @Test
    void saveAndLoadRoundTripKeepsDataConfidential() throws IOException {
        Path tempDir = Files.createTempDirectory("vault-test");
        Path payload = tempDir.resolve("session.bin");
        Path key = tempDir.resolve(".session.key");
        try {
            EncryptedSessionVault vault = new EncryptedSessionVault(payload, key);
            SessionVault.SessionRecord record = new SessionVault.SessionRecord("alice", "secret-token", Instant.now());

            vault.save(record);
            Optional<SessionVault.SessionRecord> restored = vault.load();

            assertTrue(restored.isPresent(), "La session devrait être restaurée");
            assertEquals(record.username(), restored.get().username());
            assertEquals(record.token(), restored.get().token());
            assertTrue(Files.exists(key), "La clé devrait être persistée");
            assertEquals(32, Files.readAllBytes(key).length);

            String raw = Files.readString(payload, StandardCharsets.ISO_8859_1);
            assertFalse(raw.contains("alice"));
            assertFalse(raw.contains("secret-token"));

            vault.clear();
            assertFalse(Files.exists(payload));
        } finally {
            deleteRecursively(tempDir);
        }
    }

    private void deleteRecursively(Path directory) throws IOException {
        if (directory == null || !Files.exists(directory)) {
            return;
        }
        Files.walk(directory)
                .sorted((a, b) -> b.compareTo(a))
                .forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException ignored) {
                    }
                });
    }
}
