package com.lemondelila.framework.access;

import com.lemondelila.framework.core.di.Inject;

import javax.swing.JComponent;
import java.util.Objects;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

public final class NarrationQueue implements AutoCloseable {

    private final ScreenReaderAnnouncer announcer;
    private final BlockingQueue<NarrationTask> queue = new LinkedBlockingQueue<>();
    private final Thread worker;
    private volatile boolean running = true;

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
        queue.offer(new NarrationTask(component, message));
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
