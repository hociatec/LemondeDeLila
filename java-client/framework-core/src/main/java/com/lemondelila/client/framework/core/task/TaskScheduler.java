package com.lemondelila.client.framework.core.task;

import javax.swing.SwingUtilities;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;

/**
 * Scheduler centralisé pour exécuter des tâches en arrière-plan
 * et renvoyer les résultats sur l'EDT si nécessaire.
 */
public final class TaskScheduler implements AutoCloseable {

    private final ScheduledExecutorService pool;

    public TaskScheduler() {
        this.pool = Executors.newScheduledThreadPool(
                Math.max(2, Runtime.getRuntime().availableProcessors() / 2),
                new FrameworkThreadFactory());
    }

    public ScheduledFuture<?> schedule(Runnable task, Duration delay) {
        Objects.requireNonNull(task, "task");
        Objects.requireNonNull(delay, "delay");
        return pool.schedule(task, delay.toMillis(), TimeUnit.MILLISECONDS);
    }

    public ScheduledFuture<?> scheduleAtFixedRate(Runnable task, Duration initialDelay, Duration period) {
        Objects.requireNonNull(task, "task");
        Objects.requireNonNull(initialDelay, "initialDelay");
        Objects.requireNonNull(period, "period");
        return pool.scheduleAtFixedRate(task,
                initialDelay.toMillis(),
                period.toMillis(),
                TimeUnit.MILLISECONDS);
    }

    public void runAsync(Runnable task) {
        Objects.requireNonNull(task, "task");
        pool.submit(task);
    }

    public void runOnEdt(Runnable task) {
        Objects.requireNonNull(task, "task");
        if (SwingUtilities.isEventDispatchThread()) {
            task.run();
        } else {
            SwingUtilities.invokeLater(task);
        }
    }

    @Override
    public void close() {
        pool.shutdownNow();
    }

    private static final class FrameworkThreadFactory implements ThreadFactory {
        private int counter;

        @Override
        public Thread newThread(Runnable r) {
            Thread thread = new Thread(r, "lila-scheduler-" + counter++);
            thread.setDaemon(true);
            return thread;
        }
    }
}

