package com.lemondelila.client.framework.access;

import com.lemondelila.client.framework.core.di.Inject;

import javax.swing.JComponent;
import java.util.Objects;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

public final class NarrationQueue implements AutoCloseable {

    // Anti-spam : éviter d'accumuler des dizaines d'annonces (ex: bots qui jouent vite).
    private static final int MAX_BACKLOG = 6;
    private static final long DEDUPE_WINDOW_MS = 1500L;

    private final ScreenReaderAnnouncer announcer;
    private final BlockingQueue<NarrationTask> queue = new LinkedBlockingQueue<>();
    private final Thread worker;
    private volatile boolean running = true;

    private volatile String lastEnqueuedMessage;
    private volatile long lastEnqueuedAtMs;

    @Inject
    public NarrationQueue(ScreenReaderAnnouncer announcer) {
        this.announcer = Objects.requireNonNull(announcer, "announcer");
        this.worker = new Thread(this::loop, "lila-narration-queue");
        this.worker.setDaemon(true);
        this.worker.start();
    }

    public void enqueue(JComponent component, String message) {
        Objects.requireNonNull(component, "component");
        Objects.requireNonNull(message, "message");

        String normalized = message.trim();
        if (normalized.isBlank()) {
            return;
        }

        long now = System.currentTimeMillis();
        String prev = lastEnqueuedMessage;
        long prevAt = lastEnqueuedAtMs;
        if (prev != null && prev.equals(normalized) && (now - prevAt) < DEDUPE_WINDOW_MS) {
            return;
        }

        // Si la file est trop remplie, on garde uniquement la dernière annonce
        // pour éviter l'effet "récapitulatif" en rafale.
        if (queue.size() >= MAX_BACKLOG) {
            queue.clear();
        }

        lastEnqueuedMessage = normalized;
        lastEnqueuedAtMs = now;
        queue.offer(new NarrationTask(component, normalized));
    }

    private void loop() {
        while (running) {
            try {
                NarrationTask task = queue.take();
                announcer.announce(task.component(), task.message());
                Thread.sleep(200L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    @Override
    public void close() {
        running = false;
        worker.interrupt();
        try {
            announcer.close();
        } catch (Exception ignored) {
        }
    }

    private record NarrationTask(JComponent component, String message) {
    }
}
