package com.lemondelila.client.framework.ui.lifecycle;

import java.util.concurrent.CopyOnWriteArrayList;

public final class ShutdownManager {

    private final CopyOnWriteArrayList<Runnable> hooks = new CopyOnWriteArrayList<>();

    public void addHook(Runnable hook) {
        hooks.add(hook);
    }

    public void removeHook(Runnable hook) {
        hooks.remove(hook);
    }

    public void requestExit() {
        hooks.forEach(Runnable::run);
        System.exit(0);
    }
}
