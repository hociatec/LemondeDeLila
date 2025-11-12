package com.lemondelila.client.gamelogic.damenature.controller;

import com.lemondelila.client.gamelogic.damenature.model.DameNatureConfig;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSession;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSessionStore;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureRemoteClient;
import com.lemondelila.framework.core.di.Inject;
import com.lemondelila.framework.ui.dialog.DialogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.swing.SwingUtilities;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

public final class DameNatureController {

    private static final Logger LOGGER = LoggerFactory.getLogger(DameNatureController.class);

    private final DameNatureRemoteClient remoteClient;
    private final DialogService dialogService;
    private final DameNatureSessionStore sessionStore;
    private final CopyOnWriteArrayList<Consumer<DameNatureSession>> listeners = new CopyOnWriteArrayList<>();

    private volatile DameNatureSession current;
    private volatile DameNatureConfig lastConfig = DameNatureConfig.defaultConfig();

    @Inject
    public DameNatureController(DameNatureRemoteClient remoteClient,
                                DialogService dialogService,
                                DameNatureSessionStore sessionStore) {
        this.remoteClient = Objects.requireNonNull(remoteClient, "remoteClient");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.sessionStore = Objects.requireNonNull(sessionStore, "sessionStore");
        this.current = sessionStore.current().orElse(null);
    }

    public CompletableFuture<DameNatureSession> startNewGame() {
        return startNewGame(lastConfig);
    }

    public CompletableFuture<DameNatureSession> startNewGame(DameNatureConfig config) {
        Objects.requireNonNull(config, "config");
        lastConfig = config;
        return remoteClient.startNewGame(config)
                .whenComplete((session, error) -> {
                    if (error != null) {
                        handleError("Impossible de creer la partie Dame Nature", error);
                    } else {
                        updateSession(session);
                    }
                });
    }

    public CompletableFuture<DameNatureSession> refresh() {
        DameNatureSession snapshot = current;
        if (snapshot == null) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        return remoteClient.refresh(snapshot.roomId())
                .whenComplete((session, error) -> {
                    if (error != null) {
                        handleError("Impossible de rafraichir la partie", error);
                    } else {
                        updateSession(session);
                    }
                });
    }

    public CompletableFuture<DameNatureSession> askCard(int targetId, String familyId, String memberId) {
        DameNatureSession snapshot = current;
        if (snapshot == null) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        return remoteClient.askCard(snapshot.roomId(), targetId, familyId, memberId)
                .whenComplete((session, error) -> {
                    if (error != null) {
                        handleError("Impossible de demander la carte", error);
                    } else {
                        updateSession(session);
                    }
                });
    }

    public CompletableFuture<DameNatureSession> draw() {
        DameNatureSession snapshot = current;
        if (snapshot == null) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        return remoteClient.draw(snapshot.roomId())
                .whenComplete((session, error) -> {
                    if (error != null) {
                        handleError("Impossible de piocher une carte", error);
                    } else {
                        updateSession(session);
                    }
                });
    }

    public CompletableFuture<DameNatureSession> answerQuiz(int choice) {
        DameNatureSession snapshot = current;
        if (snapshot == null) {
            return failedFuture(new IllegalStateException("Aucune partie active"));
        }
        return remoteClient.answerQuiz(snapshot.roomId(), choice)
                .whenComplete((session, error) -> {
                    if (error != null) {
                        handleError("Impossible d'envoyer la reponse au quiz", error);
                    } else {
                        updateSession(session);
                    }
                });
    }

    public void addListener(Consumer<DameNatureSession> listener) {
        listeners.add(listener);
        DameNatureSession snapshot = current;
        if (snapshot != null) {
            SwingUtilities.invokeLater(() -> listener.accept(snapshot));
        }
    }

    public void removeListener(Consumer<DameNatureSession> listener) {
        listeners.remove(listener);
    }

    public Optional<DameNatureSession> currentSession() {
        return Optional.ofNullable(current);
    }

    public void reset() {
        current = null;
        sessionStore.clearAll();
        lastConfig = DameNatureConfig.defaultConfig();
    }

    private void updateSession(DameNatureSession session) {
        current = session;
        sessionStore.save(session);
        listeners.forEach(listener ->
                SwingUtilities.invokeLater(() -> listener.accept(session))
        );
    }

    private void handleError(String context, Throwable error) {
        Throwable root = unwrap(error);
        LOGGER.warn("{} : {}", context, root.toString());
        String message = root.getMessage() != null ? root.getMessage() : root.toString();
        SwingUtilities.invokeLater(() ->
                dialogService.error("Dame Nature", context + " : " + message)
        );
    }

    private static Throwable unwrap(Throwable error) {
        Throwable cause = error;
        while (cause instanceof java.util.concurrent.CompletionException || cause instanceof java.util.concurrent.ExecutionException) {
            if (cause.getCause() == null) {
                break;
            }
            cause = cause.getCause();
        }
        return cause;
    }

    private static <T> CompletableFuture<T> failedFuture(Throwable error) {
        CompletableFuture<T> future = new CompletableFuture<>();
        future.completeExceptionally(error);
        return future;
    }
}
