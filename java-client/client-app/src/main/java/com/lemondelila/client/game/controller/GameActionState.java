package com.lemondelila.client.game.controller;

import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;

/**
 * Partage l'état d'activation des actions clavier d'un écran de jeu
 * et notifie les contrôleurs lorsque les interactions deviennent indisponibles.
 */
public final class GameActionState {

    private final AtomicBoolean enabled = new AtomicBoolean(false);
    private final CopyOnWriteArrayList<Runnable> disableListeners = new CopyOnWriteArrayList<>();

    public BooleanSupplier guard() {
        return enabled::get;
    }

    public boolean isEnabled() {
        return enabled.get();
    }

    public void setEnabled(boolean value) {
        boolean previous = enabled.getAndSet(value);
        if (previous && !value) {
            notifyDisabled();
        }
    }

    public void onDisabled(Runnable listener) {
        if (listener == null) {
            return;
        }
        disableListeners.add(listener);
    }

    private void notifyDisabled() {
        disableListeners.forEach(listener -> {
            try {
                listener.run();
            } catch (Exception ignored) {
            }
        });
    }
}
