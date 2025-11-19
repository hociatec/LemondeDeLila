package com.lemondelila.client.game.controller;

import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.game.model.DialogGameErrorHandler;
import com.lemondelila.client.game.model.GameSession;
import com.lemondelila.client.game.model.GameSessionStore;
import com.lemondelila.client.game.model.GameSessionTracker;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * Mutualise les primitives communes aux contr�leurs de jeux :
 * suivi de session, gestion des erreurs et abonnements.
 */
public final class GameControllerSupport<S extends GameSession<?>> {

    private final GameSessionTracker<S> sessions;
    private final DialogGameErrorHandler errorHandler;
    private final Map<Consumer<S>, AutoCloseable> listenerHandles = new ConcurrentHashMap<>();

    public GameControllerSupport(GameSessionStore<S> store,
                                 DomainEventBus eventBus,
                                 DialogService dialogService,
                                 String gameDisplayName) {
        this.sessions = new GameSessionTracker<>(store, eventBus);
        this.errorHandler = new DialogGameErrorHandler(dialogService, gameDisplayName);
    }

    public GameSessionTracker<S> tracker() {
        return sessions;
    }

    public DialogGameErrorHandler errors() {
        return errorHandler;
    }

    public Optional<S> currentSession() {
        return sessions.current();
    }

    public void clearSessions() {
        sessions.clearAll();
    }

    public void addListener(Consumer<S> listener) {
        AutoCloseable handle = sessions.listen(listener);
        listenerHandles.put(listener, handle);
    }

    public void removeListener(Consumer<S> listener) {
        AutoCloseable handle = listenerHandles.remove(listener);
        if (handle != null) {
            try {
                handle.close();
            } catch (Exception ignored) {
            }
        }
    }

    public static <T> CompletableFuture<T> failedFuture(Throwable error) {
        CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }

    public static RuntimeException propagate(Throwable error) {
        if (error instanceof RuntimeException runtime) {
            return runtime;
        }
        return new RuntimeException(error);
    }

    public S recordSession(S session) {
        if (session == null) {
            return null;
        }
        sessions.save(session);
        return session;
    }

    public CompletableFuture<S> applyOnActiveSession(String missingSessionMessage,
                                                     String errorContext,
                                                     Function<S, CompletableFuture<S>> action) {

        Optional<S> snapshot = currentSession();
        if (snapshot.isEmpty()) {
            return failedFuture(new IllegalStateException(
                    missingSessionMessage == null || missingSessionMessage.isBlank()
                            ? "Aucune partie active"
                            : missingSessionMessage));
        }
        return action.apply(snapshot.get())
                .thenApply(this::recordSession)
                .exceptionally(error -> {
                    if (errorContext != null && !errorContext.isBlank()) {
                        errorHandler.show(errorContext, error);
                    }
                    throw propagate(error);
                });
    }
}
