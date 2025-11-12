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
    private volatile JawsControllerBridge jaws = JawsControllerBridge.create().orElse(null);

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
            boolean spoken = speakWithNvda(message);
            if (!spoken) {
                spoken = speakWithJaws(message);
            }
            if (!spoken) {
                LOGGER.log(Level.FINE, "Aucun moteur de synthèse n'a pu lire le message.");
                NativeDiagnosticsLogger.get().log("No screen reader accepted message: " + message);
            }
        });
    }

    @Override
    public void close() {
        NvdaControllerBridge bridge = nvda;
        if (bridge != null) {
            bridge.cancel();
        }
        JawsControllerBridge jawsBridge = jaws;
        if (jawsBridge != null) {
            jawsBridge.stop();
            jawsBridge.shutdown();
        }
        executor.shutdownNow();
    }

    private boolean speakWithNvda(String message) {
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
                LOGGER.log(Level.FINEST, "Message transmis à NVDA.");
            }
            return ok;
        }
        return false;
    }

    private boolean speakWithJaws(String message) {
        JawsControllerBridge bridge = jaws;
        if (bridge == null) {
            bridge = JawsControllerBridge.create().orElse(null);
            jaws = bridge;
        }
        if (bridge != null) {
            boolean ok = bridge.speak(message);
            if (!ok) {
                LOGGER.log(Level.FINER, "JAWS FSAPI could not speak message.");
            } else {
                LOGGER.log(Level.FINEST, "Message transmis à JAWS.");
            }
            return ok;
        }
        return false;
    }
}
