package com.lemondelila.client.framework.access.shortcut;

import javax.swing.JComponent;
import javax.swing.KeyStroke;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

public final class AccessibleShortcutRegistry {

    private final Map<KeyStroke, String> descriptions = new LinkedHashMap<>();

    public void register(KeyStroke stroke, String description) {
        Objects.requireNonNull(stroke, "stroke");
        Objects.requireNonNull(description, "description");
        descriptions.put(stroke, description);
    }

    public void clear() {
        descriptions.clear();
    }

    public AutoCloseable applyTo(JComponent component) {
        Objects.requireNonNull(component, "component");
        Object previous = component.getClientProperty("accessible.shortcuts");
        Map<KeyStroke, String> snapshot = Collections.unmodifiableMap(descriptions);
        component.putClientProperty("accessible.shortcuts", snapshot);
        return () -> component.putClientProperty("accessible.shortcuts", previous);
    }

    public Map<KeyStroke, String> registered() {
        return Collections.unmodifiableMap(descriptions);
    }
}
