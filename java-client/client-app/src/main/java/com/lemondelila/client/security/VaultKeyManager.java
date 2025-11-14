package com.lemondelila.client.security;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.DosFileAttributeView;
import java.nio.file.attribute.PosixFilePermission;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.EnumSet;
import java.util.Set;

final class VaultKeyManager {

    private static final int KEY_BYTES = 32;
    private final Path keyFile;
    private final SecureRandom random = new SecureRandom();
    private volatile SecretKey cachedKey;

    VaultKeyManager(Path keyFile) {
        this.keyFile = keyFile;
    }

    SecretKey key() throws IOException, GeneralSecurityException {
        SecretKey current = cachedKey;
        if (current != null) {
            return current;
        }
        synchronized (this) {
            if (cachedKey == null) {
                cachedKey = loadOrCreate();
            }
            return cachedKey;
        }
    }

    private SecretKey loadOrCreate() throws IOException {
        if (Files.isReadable(keyFile)) {
            byte[] bytes = Files.readAllBytes(keyFile);
            return new SecretKeySpec(bytes, "AES");
        }
        byte[] keyBytes = new byte[KEY_BYTES];
        random.nextBytes(keyBytes);
        Files.createDirectories(keyFile.getParent());
        Files.write(keyFile, keyBytes, StandardOpenOption.CREATE_NEW);
        lockDownPermissions();
        return new SecretKeySpec(keyBytes, "AES");
    }

    private void lockDownPermissions() {
        try {
            Set<PosixFilePermission> perms = EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE);
            Files.setPosixFilePermissions(keyFile, perms);
        } catch (UnsupportedOperationException ignored) {
        } catch (IOException ignored) {
        }
        try {
            DosFileAttributeView dos = Files.getFileAttributeView(keyFile, DosFileAttributeView.class);
            if (dos != null) {
                dos.setHidden(true);
            }
        } catch (IOException ignored) {
        }
    }
}
