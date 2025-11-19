package com.lemondelila.client.security;

import java.time.Instant;
import java.util.Optional;

/**
 * Persists the authentication token locally in an opaque, encrypted format.
 */
public interface SessionVault {

    record SessionRecord(String username, String token, Instant storedAt) {}

    /**
     * Reads the stored session if one exists and can be decrypted.
     */
    Optional<SessionRecord> load();

    /**
     * Writes (or replaces) the stored session snapshot.
     */
    void save(SessionRecord record);

    /**
     * Removes any persisted snapshot.
     */
    void clear();
}
