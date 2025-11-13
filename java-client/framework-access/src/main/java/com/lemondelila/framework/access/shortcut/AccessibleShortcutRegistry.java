package com.lemondelila.framework.access.shortcut;

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

    public void applyTo(JComponent component) {
        component.putClientProperty("accessible.shortcuts", Collections.unmodifiableMap(descriptions));
    }

    public Map<KeyStroke, String> registered() {
        return Collections.unmodifiableMap(descriptions);
    }
}

