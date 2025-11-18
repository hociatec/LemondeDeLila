package com.lemondelila.client.gamelogic.damenature.controller;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSession;
import com.lemondelila.client.gamelogic.damenature.service.DameNatureRemoteClient;
import com.lemondelila.client.game.model.DialogGameErrorHandler;
import com.lemondelila.client.game.model.GameSessionTracker;

import java.util.Optional;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;

final class DameNatureActionController {

    private final DameNatureRemoteClient remoteClient;
    private final GameSessionTracker<DameNatureSession> sessions;
    private final DialogGameErrorHandler errorHandler;

    DameNatureActionController(DameNatureRemoteClient remoteClient,
                               GameSessionTracker<DameNatureSession> sessions,
                               DialogGameErrorHandler errorHandler) {
        this.remoteClient = Objects.requireNonNull(remoteClient, "remoteClient");
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.errorHandler = Objects.requireNonNull(errorHandler, "errorHandler");
    }

    CompletableFuture<DameNatureSession> refresh() {
        Optional<DameNatureSession> snapshot = sessions.current();
        if (snapshot.isEmpty()) {
            return CompletableFuture.failedFuture(new IllegalStateException(t("damenature.controller.no.session")));
        }
        CompletableFuture<DameNatureSession> future = remoteClient.refresh(snapshot.get().roomId());
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show(t("damenature.controller.refresh.error"), error);
                return;
            }
            if (session != null) {
                sessions.save(session);
            }
        });
        return future;
    }

    CompletableFuture<DameNatureSession> askCard(int targetId, String familyId, String memberId) {
        Optional<DameNatureSession> snapshot = sessions.current();
        if (snapshot.isEmpty()) {
            return CompletableFuture.failedFuture(new IllegalStateException(t("damenature.controller.no.session")));
        }
        CompletableFuture<DameNatureSession> future = remoteClient.askCard(snapshot.get().roomId(), targetId, familyId, memberId);
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show(t("damenature.controller.ask.error"), error);
                return;
            }
            if (session != null) {
                sessions.save(session);
            }
        });
        return future;
    }

    CompletableFuture<DameNatureSession> draw() {
        Optional<DameNatureSession> snapshot = sessions.current();
        if (snapshot.isEmpty()) {
            return CompletableFuture.failedFuture(new IllegalStateException(t("damenature.controller.no.session")));
        }
        CompletableFuture<DameNatureSession> future = remoteClient.draw(snapshot.get().roomId());
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show(t("damenature.controller.draw.error"), error);
                return;
            }
            if (session != null) {
                sessions.save(session);
            }
        });
        return future;
    }

    CompletableFuture<DameNatureSession> answerQuiz(int choice) {
        Optional<DameNatureSession> snapshot = sessions.current();
        if (snapshot.isEmpty()) {
            return CompletableFuture.failedFuture(new IllegalStateException(t("damenature.controller.no.session")));
        }
        CompletableFuture<DameNatureSession> future = remoteClient.answerQuiz(snapshot.get().roomId(), choice);
        future.whenComplete((session, error) -> {
            if (error != null) {
                errorHandler.show(t("damenature.controller.quiz.error"), error);
                return;
            }
            if (session != null) {
                sessions.save(session);
            }
        });
        return future;
    }

    private static String t(String key, Object... args) {
        return Internationalization.text(key, args);
    }
}
