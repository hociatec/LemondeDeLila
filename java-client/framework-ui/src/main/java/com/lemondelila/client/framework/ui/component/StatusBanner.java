package com.lemondelila.client.framework.ui.component;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.NarrationQueue;

import javax.swing.JLabel;
import java.awt.Component;
import java.util.Objects;

/**
 * Petit composant utilitaire pour afficher un message d'état
 * et le relayer vers la file de narration.
 */
public final class StatusBanner {

    private final JLabel label = new JLabel(" ");
    private final NarrationQueue narrationQueue;

    public StatusBanner(String accessibleName,
                        String accessibleDescription,
                        Component alignmentReference,
                        NarrationQueue narrationQueue) {
        this.narrationQueue = narrationQueue;
        if (alignmentReference != null) {
            label.setAlignmentX(alignmentReference.getAlignmentX());
        }
        AccessibleDecorator.apply(label, AccessibleSpec.builder()
                .name(Objects.requireNonNullElse(accessibleName, "Statut"))
                .description(Objects.requireNonNullElse(accessibleDescription, "Annonce l'état actuel de l'écran"))
                .build());
    }

    public JLabel component() {
        return label;
    }

    public void setStatus(String text) {
        String safe = text == null || text.isBlank() ? " " : text;
        label.setText(safe);
        if (narrationQueue != null && !safe.isBlank()) {
            narrationQueue.enqueue(label, safe);
        }
    }
}
