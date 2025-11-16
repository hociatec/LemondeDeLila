package com.lemondelila.client.framework.core.task;

import javax.swing.SwingUtilities;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
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
    private final CopyOnWriteArrayList<TaskListener> listeners = new CopyOnWriteArrayList<>();

    public TaskScheduler() {
        this.pool = Executors.newScheduledThreadPool(
                Math.max(2, Runtime.getRuntime().availableProcessors() / 2),
                new FrameworkThreadFactory());
    }

    public ScheduledFuture<?> schedule(Runnable task, Duration delay) {
        Objects.requireNonNull(task, "task");
        Objects.requireNonNull(delay, "delay");
        Runnable wrapped = wrap(null, task);
        return pool.schedule(wrapped, delay.toMillis(), TimeUnit.MILLISECONDS);
    }

    public ScheduledFuture<?> scheduleAtFixedRate(Runnable task, Duration initialDelay, Duration period) {
        Objects.requireNonNull(task, "task");
        Objects.requireNonNull(initialDelay, "initialDelay");
        Objects.requireNonNull(period, "period");
        Runnable wrapped = wrap(null, task);
        return pool.scheduleAtFixedRate(wrapped,
                initialDelay.toMillis(),
                period.toMillis(),
                TimeUnit.MILLISECONDS);
    }

    public void runAsync(Runnable task) {
        Objects.requireNonNull(task, "task");
        submit(null, task);
    }

    public TaskHandle submit(String name, Runnable task) {
        Objects.requireNonNull(task, "task");
        Future<?> future = pool.submit(wrap(name, task));
        return new FutureHandle(future);
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

    public AutoCloseable listen(TaskListener listener) {
        Objects.requireNonNull(listener, "listener");
        listeners.add(listener);
        return () -> listeners.remove(listener);
    }

    private Runnable wrap(String name, Runnable task) {
        return () -> {
            notifyScheduled(name);
            Throwable failure = null;
            try {
                task.run();
            } catch (Throwable ex) {
                failure = ex;
                throw ex;
            } finally {
                notifyCompleted(name, failure);
            }
        };
    }

    private void notifyScheduled(String name) {
        listeners.forEach(listener -> {
            try {
                listener.onTaskScheduled(name);
            } catch (Exception ignored) {
            }
        });
    }

    private void notifyCompleted(String name, Throwable error) {
        listeners.forEach(listener -> {
            try {
                listener.onTaskCompleted(name, error);
            } catch (Exception ignored) {
            }
        });
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

    public interface TaskListener {
        void onTaskScheduled(String name);

        void onTaskCompleted(String name, Throwable error);
    }

    public interface TaskHandle {
        void cancel(boolean mayInterrupt);

        boolean isDone();

        boolean isCancelled();

        default void await() throws InterruptedException, ExecutionException {
            // default no-op
        }
    }

    private static final class FutureHandle implements TaskHandle {
        private final Future<?> future;

        private FutureHandle(Future<?> future) {
            this.future = future;
        }

        @Override
        public void cancel(boolean mayInterrupt) {
            future.cancel(mayInterrupt);
        }

        @Override
        public boolean isDone() {
            return future.isDone();
        }

        @Override
        public boolean isCancelled() {
            return future.isCancelled();
        }

        @Override
        public void await() throws InterruptedException, ExecutionException {
            future.get();
        }
    }
}
