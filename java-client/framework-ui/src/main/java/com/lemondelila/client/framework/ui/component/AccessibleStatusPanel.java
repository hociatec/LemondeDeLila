package com.lemondelila.client.framework.ui.component;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;

import javax.swing.JLabel;
import java.util.Objects;

/**
 * Label accessible qui simplifie la mise a jour du texte et de la description et force un
 * evenement d'accessibilite pour les lecteurs d'ecran.
 */
public final class AccessibleStatusPanel {

    private final JLabel label = new JLabel(" ");

    public AccessibleStatusPanel(String accessibleName, String accessibleDescription) {
        AccessibleDecorator.apply(label, AccessibleSpec.builder()
                .name(Objects.requireNonNullElse(accessibleName, "Statut"))
                .description(Objects.requireNonNullElse(accessibleDescription, "Indique l'etat"))
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
        var context = label.getAccessibleContext();
        context.setAccessibleDescription(description);
        context.setAccessibleName(description);
        context.firePropertyChange(
                javax.accessibility.AccessibleContext.ACCESSIBLE_DESCRIPTION_PROPERTY,
                null,
                description
        );
    }
}
