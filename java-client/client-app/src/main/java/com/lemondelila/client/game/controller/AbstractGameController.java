package com.lemondelila.client.game.controller;

import com.lemondelila.client.game.model.GameSession;

import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * Contrôleur de jeu générique qui encapsule la gestion de session,
 * les listeners et la logique standard de démarrage/réutilisation d'une partie.
 */
public abstract class AbstractGameController<S extends GameSession<?>> {

    protected static final String DEFAULT_NO_SESSION = "Aucune partie active.";
    private final GameControllerSupport<S> support;
    private final String defaultNoSessionMessage;

    protected AbstractGameController(GameControllerSupport<S> support) {
        this(support, DEFAULT_NO_SESSION);
    }

    protected AbstractGameController(GameControllerSupport<S> support,
                                     String noSessionMessage) {
        this.support = Objects.requireNonNull(support, "support");
        this.defaultNoSessionMessage = (noSessionMessage == null || noSessionMessage.isBlank())
                ? DEFAULT_NO_SESSION
                : noSessionMessage;
    }

    protected GameControllerSupport<S> support() {
        return support;
    }

    protected CompletableFuture<S> startOrReuseGame(boolean forceNew,
                                                    Supplier<CompletableFuture<S>> starter,
                                                    String errorContext) {
        Objects.requireNonNull(starter, "starter");
        if (!forceNew) {
            Optional<S> snapshot = support.currentSession();
            if (snapshot.isPresent()) {
                return CompletableFuture.completedFuture(snapshot.get());
            }
        }
        return starter.get()
                .thenApply(support::recordSession)
                .exceptionally(error -> {
                    if (errorContext != null && !errorContext.isBlank()) {
                        support.errors().show(errorContext, error);
                    }
                    throw GameControllerSupport.propagate(error);
                });
    }

    protected CompletableFuture<S> runWithActiveSession(String missingSessionMessage,
                                                        String errorContext,
                                                        Function<S, CompletableFuture<S>> action) {
        String resolvedMessage = (missingSessionMessage == null || missingSessionMessage.isBlank())
                ? defaultNoSessionMessage
                : missingSessionMessage;
        return support.applyOnActiveSession(resolvedMessage, errorContext, action);
    }

    public Optional<S> currentSession() {
        return support.currentSession();
    }

    public void addSessionListener(Consumer<S> listener) {
        support.addListener(listener);
    }

    public void removeSessionListener(Consumer<S> listener) {
        support.removeListener(listener);
    }

    public void resetSessions() {
        support.clearSessions();
    }
}
