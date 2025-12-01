package com.lemondelila.client.security;

import java.time.Instant;
import java.util.Optional;

/**
 * Persists user credentials locally in an opaque, encrypted format for pre-filling the login form.
 */
public interface CredentialsVault {

    record CredentialRecord(String username, String password, Instant storedAt) {}

    /**
     * Reads the stored credentials if available and decryptable.
     */
    Optional<CredentialRecord> load();

    /**
     * Writes (or replaces) the stored credentials snapshot.
     */
    void save(CredentialRecord record);

    /**
     * Removes any persisted snapshot.
     */
    void clear();
}
