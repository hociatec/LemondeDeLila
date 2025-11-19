package com.lemondelila.client.framework.ui.component;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;

import javax.swing.JLabel;
import java.util.Objects;

/**
 * Label accessible qui simplifie la mise à jour du texte et de la description.
 */
public final class AccessibleStatusPanel {

    private final JLabel label = new JLabel(" ");

    public AccessibleStatusPanel(String accessibleName, String accessibleDescription) {
        AccessibleDecorator.apply(label, AccessibleSpec.builder()
                .name(Objects.requireNonNullElse(accessibleName, "Statut"))
                .description(Objects.requireNonNullElse(accessibleDescription, "Indique l'état"))
                .build());
        label.setFocusable(false);
    }

    public JLabel component() {
        return label;
    }

    public void setStatus(String text, String accessibleDescription) {
        String safeText = text == null ? " " : text;
        label.setText(safeText);
        String description = accessibleDescription == null ? safeText : accessibleDescription;
        if (description == null || description.isBlank()) {
            description = safeText;
        }
        label.getAccessibleContext().setAccessibleDescription(description);
    }
}
