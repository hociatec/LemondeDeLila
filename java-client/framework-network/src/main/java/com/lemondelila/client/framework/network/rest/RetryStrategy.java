package com.lemondelila.client.framework.network.rest;

import java.io.IOException;
import java.time.Duration;

/**
 * Définit la stratégie de répétition en cas d'erreurs transitoires.
 */
public interface RetryStrategy {

    /**
     * Détermine si la tentative identifiée par {@code attempt} doit être rejetée.
     */
    boolean shouldRetry(int attempt, IOException failure);

    /**
     * Retourne le délai d'attente avant la prochaine tentative (0 = pas d'attente).
     */
    Duration nextDelay(int attempt);

    RetryStrategy NONE = new RetryStrategy() {
        @Override
        public boolean shouldRetry(int attempt, IOException failure) {
            return false;
        }

        @Override
        public Duration nextDelay(int attempt) {
            return Duration.ZERO;
        }
    };
}
