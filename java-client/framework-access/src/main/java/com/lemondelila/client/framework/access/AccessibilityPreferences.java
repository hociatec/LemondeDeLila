package com.lemondelila.client.framework.access;

import javax.accessibility.AccessibleContext;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Préférences d'accessibilité globales (ex: activation des descriptions complémentaires).
 */
public final class AccessibilityPreferences {

    private static final AtomicBoolean EXTRA_DESCRIPTIONS_ENABLED = new AtomicBoolean(true);

    private AccessibilityPreferences() {
    }

    public static boolean extraDescriptionsEnabled() {
        return EXTRA_DESCRIPTIONS_ENABLED.get();
    }

    public static void setExtraDescriptionsEnabled(boolean enabled) {
        EXTRA_DESCRIPTIONS_ENABLED.set(enabled);
    }

    public static void applyDescription(AccessibleContext context, String description) {
        if (context == null) {
            return;
        }
        if (extraDescriptionsEnabled()) {
            context.setAccessibleDescription(description);
        } else {
            context.setAccessibleDescription(null);
        }
    }
}
