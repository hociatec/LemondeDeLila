package com.lemondelila.framework.access;

import javax.accessibility.AccessibleContext;
import javax.swing.JComponent;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class ScreenReaderAnnouncer implements AutoCloseable {

    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "lila-narration");
        t.setDaemon(true);
        return t;
    });

    public void announce(JComponent component, String message) {
        Objects.requireNonNull(component, "component");
        Objects.requireNonNull(message, "message");
        AccessibleContext context = component.getAccessibleContext();
        if (context == null) {
            return;
        }
        executor.submit(() -> context.firePropertyChange(
                AccessibleContext.ACCESSIBLE_DESCRIPTION_PROPERTY,
                null,
                message
        ));
    }

    @Override
    public void close() {
        executor.shutdownNow();
    }
}

