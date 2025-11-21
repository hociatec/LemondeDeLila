package com.lemondelila.client.framework.core.util;

import java.util.concurrent.atomic.AtomicLong;

/**
 * Rate limiter minimaliste : autorise une action si le delai minimal
 * (en millisecondes) s'est ecoule depuis la derniere acquisition.
 */
public final class SimpleRateLimiter {

    private final long minIntervalMillis;
    private final AtomicLong lastAcquired = new AtomicLong(0);

    public SimpleRateLimiter(long minIntervalMillis) {
        this.minIntervalMillis = Math.max(0, minIntervalMillis);
    }

    public boolean tryAcquire() {
        long now = System.currentTimeMillis();
        long previous = lastAcquired.get();
        if (now - previous < minIntervalMillis) {
            return false;
        }
        return lastAcquired.compareAndSet(previous, now) || now - lastAcquired.get() >= minIntervalMillis;
    }
}
