package com.lemondelila.client.framework.network.rest;

import java.io.IOException;
import java.time.Duration;

/**
 * Estrategie de retries exponentiels avec un nombre maximum de tentatives.
 */
public final class DefaultRetryStrategy implements RetryStrategy {

    private final int maxAttempts;
    private final Duration baseDelay;

    public DefaultRetryStrategy(int maxAttempts, Duration baseDelay) {
        if (maxAttempts < 1) {
            throw new IllegalArgumentException("maxAttempts doit être positif");
        }
        this.maxAttempts = maxAttempts;
        this.baseDelay = baseDelay == null ? Duration.ZERO : baseDelay;
    }

    @Override
    public boolean shouldRetry(int attempt, IOException failure) {
        return attempt < maxAttempts;
    }

    @Override
    public Duration nextDelay(int attempt) {
        if (attempt <= 0 || baseDelay.isZero()) {
            return baseDelay;
        }
        int exponent = Math.min(attempt - 1, 6);
        return baseDelay.multipliedBy(1L << exponent);
    }
}
