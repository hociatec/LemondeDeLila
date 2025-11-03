package com.lemondelila.client.user.model;

import java.time.Instant;
import java.util.Optional;

/**
 * Modele pour suivre les inscriptions reussies.
 */
public final class RegistrationModel {

    private boolean registered;
    private Instant registeredAt;

    public synchronized void markRegistered() {
        this.registered = true;
        this.registeredAt = Instant.now();
    }

    public synchronized void reset() {
        this.registered = false;
        this.registeredAt = null;
    }

    public synchronized boolean hasRegistered() {
        return registered;
    }

    public synchronized Optional<Instant> registeredAt() {
        return Optional.ofNullable(registeredAt);
    }
}
