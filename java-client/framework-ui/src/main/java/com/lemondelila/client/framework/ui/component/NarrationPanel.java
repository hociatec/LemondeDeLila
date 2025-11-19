package com.lemondelila.client.framework.ui.component;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;

import javax.accessibility.AccessibleContext;
import javax.swing.JLabel;
import javax.swing.SwingUtilities;
import java.awt.Dimension;
import java.util.Objects;

/**
 * Petit composant invisible qui expose un point d'ancrage pour les annonces vocales
 * et réactualise ses propriétés accessibles même lorsque le message ne change pas.
 */
public final class NarrationPanel {

    private static final Dimension HIDDEN_SIZE = new Dimension(1, 1);
    private final JLabel bridge = new JLabel(" ");
    private final String accessibleName;
    private final String accessibleDescription;
    private boolean toggle;
    private String lastMessage;

    public NarrationPanel(String accessibleName, String accessibleDescription) {
        this.accessibleName = Objects.requireNonNullElse(accessibleName, "Narration");
        this.accessibleDescription = Objects.requireNonNullElse(accessibleDescription, "Flux de narration");
        configureBridge();
    }

    public JLabel component() {
        return bridge;
    }

    public void announce(String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        String payload = buildPayload(message);
        refreshAccessibleContext(payload);
    }

    private void configureBridge() {
        bridge.setFocusable(false);
        bridge.setOpaque(false);
        bridge.setVisible(true);
        bridge.setForeground(bridge.getBackground());
        bridge.setPreferredSize(HIDDEN_SIZE);
        bridge.setMinimumSize(HIDDEN_SIZE);
        bridge.setMaximumSize(HIDDEN_SIZE);
        AccessibleDecorator.apply(bridge, AccessibleSpec.builder()
                .name(accessibleName)
                .description(accessibleDescription)
                .build());
    }

    private String buildPayload(String message) {
        if (Objects.equals(message, lastMessage)) {
            toggle = !toggle;
            return message + (toggle ? " \u200B" : " \u200C");
        }
        toggle = false;
        lastMessage = message;
        return message;
    }

    private void refreshAccessibleContext(String payload) {
        AccessibleContext context = bridge.getAccessibleContext();
        if (context == null) {
            return;
        }
        Runnable update = () -> {
            String textPayload = payload;
            bridge.setText(textPayload);
            context.setAccessibleDescription(textPayload);
            context.firePropertyChange(AccessibleContext.ACCESSIBLE_TEXT_PROPERTY, null, textPayload);
            context.firePropertyChange(AccessibleContext.ACCESSIBLE_NAME_PROPERTY, null, textPayload);
            context.firePropertyChange(AccessibleContext.ACCESSIBLE_DESCRIPTION_PROPERTY, null, textPayload);
            context.firePropertyChange(AccessibleContext.ACCESSIBLE_VISIBLE_DATA_PROPERTY, null, textPayload);
        };
        if (SwingUtilities.isEventDispatchThread()) {
            update.run();
        } else {
            SwingUtilities.invokeLater(update);
        }
    }
}
