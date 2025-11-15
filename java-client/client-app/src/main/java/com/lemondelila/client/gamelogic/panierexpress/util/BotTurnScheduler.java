package com.lemondelila.client.gamelogic.panierexpress.util;

import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressController;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState;

import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public final class BotTurnScheduler {
    private static final long BOT_DELAY_SECONDS = 6L;

    private final PanierExpressController controller;
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "panierexpress-bot-delay");
        thread.setDaemon(true);
        return thread;
    });
    private final AtomicBoolean pending = new AtomicBoolean(false);
    private volatile long trackedRoomId = -1;
    private ScheduledFuture<?> pendingTask;

    public BotTurnScheduler(PanierExpressController controller) {
        this.controller = Objects.requireNonNull(controller, "controller");
    }

    public synchronized void evaluate(PanierExpressSession session, boolean eligibleCoordinator) {
        if (!eligibleCoordinator || session == null) {
            cancelLocked();
            return;
        }
        PanierExpressState state = session.state();
        if (state == null || state.isFinished()) {
            cancelLocked();
            return;
        }
        Optional<PanierExpressState.Player> active = state.currentPlayer();
        if (active.isEmpty() || !active.get().isBot()) {
            cancelLocked();
            return;
        }
        long roomId = session.roomId();
        if (pending.get() && trackedRoomId == roomId) {
            return;
        }
        trackedRoomId = roomId;
        pending.set(true);
        pendingTask = executor.schedule(() -> triggerBotTurn(roomId), BOT_DELAY_SECONDS, TimeUnit.SECONDS);
    }

    private void triggerBotTurn(long roomId) {
        CompletableFuture<PanierExpressSession> future = controller.roll();
        future.whenComplete((s, error) -> clearPending());
    }

    public synchronized void cancel() {
        cancelLocked();
    }

    public synchronized void shutdown() {
        cancelLocked();
        executor.shutdownNow();
    }

    private void clearPending() {
        synchronized (this) {
            pending.set(false);
            if (pendingTask != null) {
                pendingTask = null;
            }
            trackedRoomId = -1;
        }
    }

    private void cancelLocked() {
        pending.set(false);
        trackedRoomId = -1;
        if (pendingTask != null) {
            pendingTask.cancel(true);
            pendingTask = null;
        }
    }
}
