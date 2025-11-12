package com.lemondelila.framework.access;

import javax.accessibility.AccessibleContext;
import javax.swing.JComponent;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.logging.Level;
import java.util.logging.Logger;

public final class ScreenReaderAnnouncer implements AutoCloseable {

    private static final Logger LOGGER = Logger.getLogger(ScreenReaderAnnouncer.class.getName());

    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "lila-narration");
        t.setDaemon(true);
        return t;
    });
    private volatile NvdaControllerBridge nvda = NvdaControllerBridge.create().orElse(null);

    public void announce(JComponent component, String message) {
        Objects.requireNonNull(component, "component");
        Objects.requireNonNull(message, "message");
        AccessibleContext context = component.getAccessibleContext();
        executor.submit(() -> {
            if (context != null) {
                Runnable fireEvent = () -> context.firePropertyChange(
                        AccessibleContext.ACCESSIBLE_DESCRIPTION_PROPERTY,
                        null,
                        message
                );
                if (javax.swing.SwingUtilities.isEventDispatchThread()) {
                    fireEvent.run();
                } else {
                    javax.swing.SwingUtilities.invokeLater(fireEvent);
                }
            }
            boolean spoken = false;
            NvdaControllerBridge bridge = nvda;
            if (bridge == null) {
                bridge = NvdaControllerBridge.create().orElse(null);
                nvda = bridge;
            }
            if (bridge != null) {
                boolean ok = bridge.speak(message);
                if (!ok) {
                    LOGGER.log(Level.FINER, "NVDA controller could not speak message.");
                } else {
                    spoken = true;
                }
            }
            if (!spoken) {
                LOGGER.log(Level.FINEST, "Aucun moteur de synthèse n'a pu lire le message.");
            }
        });
    }

    @Override
    public void close() {
        NvdaControllerBridge bridge = nvda;
        if (bridge != null) {
            bridge.cancel();
        }
        executor.shutdownNow();
    }
}
