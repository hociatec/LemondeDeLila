package com.lemondelila.client.security;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Optional;

/**
 * AES/GCM storage for remembered credentials (only used to pre-remplir les champs du formulaire).
 */
public final class EncryptedCredentialsVault implements CredentialsVault {

    private static final Logger LOGGER = LoggerFactory.getLogger(EncryptedCredentialsVault.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_LENGTH = 128;
    private static final int IV_LENGTH = 12;

    private final Path payloadFile;
    private final VaultKeyManager keyManager;
    private final SecureRandom random = new SecureRandom();

    public EncryptedCredentialsVault(Path payloadFile, Path keyFile) {
        this.payloadFile = payloadFile;
        this.keyManager = new VaultKeyManager(keyFile);
    }

    public static EncryptedCredentialsVault defaultVault() {
        Path directory = Path.of("config");
        return new EncryptedCredentialsVault(directory.resolve("credentials.bin"), directory.resolve(".credentials.key"));
    }

    @Override
    public Optional<CredentialRecord> load() {
        if (!Files.isReadable(payloadFile)) {
            return Optional.empty();
        }
        try {
            byte[] encrypted = Files.readAllBytes(payloadFile);
            byte[] decoded = decrypt(encrypted);
            VaultPayload payload = MAPPER.readValue(decoded, VaultPayload.class);
            return Optional.of(new CredentialRecord(
                    payload.username(),
                    payload.password(),
                    Instant.ofEpochMilli(payload.storedAt())
            ));
        } catch (Exception ex) {
            LOGGER.warn("Impossible de lire les identifiants memorises : {}", ex.getMessage());
            clear();
            return Optional.empty();
        }
    }

    @Override
    public void save(CredentialRecord record) {
        if (record == null) {
            clear();
            return;
        }
        VaultPayload payload = new VaultPayload(record.username(), record.password(), record.storedAt().toEpochMilli());
        try {
            byte[] serialized = MAPPER.writeValueAsBytes(payload);
            byte[] encrypted = encrypt(serialized);
            Files.createDirectories(payloadFile.getParent());
            Files.write(payloadFile, encrypted, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);
        } catch (Exception ex) {
            LOGGER.error("Impossible de sauvegarder les identifiants memorises", ex);
        }
    }

    @Override
    public void clear() {
        try {
            Files.deleteIfExists(payloadFile);
        } catch (IOException ignored) {
        }
    }

    private byte[] encrypt(byte[] plainText) throws GeneralSecurityException, IOException {
        SecretKey key = keyManager.key();
        byte[] iv = new byte[IV_LENGTH];
        random.nextBytes(iv);
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
        byte[] encrypted = cipher.doFinal(plainText);
        ByteBuffer buffer = ByteBuffer.allocate(iv.length + encrypted.length);
        buffer.put(iv);
        buffer.put(encrypted);
        return buffer.array();
    }

    private byte[] decrypt(byte[] encrypted) throws GeneralSecurityException, IOException {
        if (encrypted == null || encrypted.length <= IV_LENGTH) {
            throw new GeneralSecurityException("Payload invalide");
        }
        SecretKey key = keyManager.key();
        ByteBuffer buffer = ByteBuffer.wrap(encrypted);
        byte[] iv = new byte[IV_LENGTH];
        buffer.get(iv);
        byte[] cipherText = new byte[buffer.remaining()];
        buffer.get(cipherText);
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH, iv));
        return cipher.doFinal(cipherText);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record VaultPayload(
            @JsonProperty("username") String username,
            @JsonProperty("password") String password,
            @JsonProperty("storedAt") long storedAt
    ) {
    }
}
