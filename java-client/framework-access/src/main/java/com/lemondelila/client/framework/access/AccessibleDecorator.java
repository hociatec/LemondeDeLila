package com.lemondelila.client.framework.access;

import javax.accessibility.Accessible;
import javax.accessibility.AccessibleContext;
import javax.swing.JComponent;
import java.util.Objects;

public final class AccessibleDecorator {

    private AccessibleDecorator() {
    }

    public static void apply(JComponent component, AccessibleSpec spec) {
        Objects.requireNonNull(component, "component");
        Objects.requireNonNull(spec, "spec");
        AccessibleContext context = component.getAccessibleContext();
        if (context == null) {
            return;
        }
        spec.name().ifPresent(context::setAccessibleName);
        spec.description().ifPresent(desc -> AccessibilityPreferences.applyDescription(context, desc));
        spec.shortcut().ifPresent(shortcut -> context.firePropertyChange(
                AccessibleContext.ACCESSIBLE_ACTION_PROPERTY,
                null,
                shortcut
        ));
    }

    public static void copyMetadata(Accessible from, Accessible to) {
        Objects.requireNonNull(from, "from");
        Objects.requireNonNull(to, "to");
        AccessibleContext source = from.getAccessibleContext();
        AccessibleContext target = to.getAccessibleContext();
        if (source == null || target == null) {
            return;
        }
        target.setAccessibleName(source.getAccessibleName());
        AccessibilityPreferences.applyDescription(target, source.getAccessibleDescription());
    }
}
