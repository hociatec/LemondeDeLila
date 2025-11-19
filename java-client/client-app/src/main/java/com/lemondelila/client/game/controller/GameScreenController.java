package com.lemondelila.client.game.controller;

import com.lemondelila.client.game.model.GameSession;

import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * Contrat minimal pour piloter un écran de jeu : écoute de session,
 * rafraîchissement et remise à zéro.
 */
public interface GameScreenController<S extends GameSession<?>> {

    void addSessionListener(Consumer<S> listener);

    void removeSessionListener(Consumer<S> listener);

    Optional<S> currentSession();

    CompletableFuture<S> refreshGame();

    void reset();
}

