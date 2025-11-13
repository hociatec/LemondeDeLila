package com.lemondelila.client.controller.user;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Shared guard that prevents launching multiple concurrent user operations
 * such as login and registration.
 */
public final class UserOperationGuard {

    private final AtomicBoolean busy = new AtomicBoolean(false);

    boolean tryAcquire() {
        return busy.compareAndSet(false, true);
    }

    void release() {
        busy.set(false);
    }
}
