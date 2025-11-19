package com.lemondelila.client.game.service;

/**
 * Limiteur simple basé sur les timestamps pour éviter les actions trop fréquentes.
 */
public final class SimpleRateLimiter {

    private final long minIntervalMillis;
    private volatile long lastExecution;

    public SimpleRateLimiter(long minIntervalMillis) {
        this.minIntervalMillis = minIntervalMillis;
    }

    public synchronized boolean tryAcquire() {
        long now = System.currentTimeMillis();
        if (now - lastExecution >= minIntervalMillis) {
            lastExecution = now;
            return true;
        }
        return false;
    }
}
