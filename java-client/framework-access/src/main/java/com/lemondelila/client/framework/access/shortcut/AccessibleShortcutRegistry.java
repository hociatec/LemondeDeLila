package com.lemondelila.client.framework.access.shortcut;

import javax.swing.JComponent;
import javax.swing.KeyStroke;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class AccessibleShortcutRegistry {

    private final Map<KeyStroke, String> descriptions = new LinkedHashMap<>();
    private final Deque<ShortcutScope> scopes = new ArrayDeque<>();

    public void register(KeyStroke stroke, String description) {
        Objects.requireNonNull(stroke, "stroke");
        Objects.requireNonNull(description, "description");
        String previous = descriptions.put(stroke, description);
        recordChange(stroke, previous);
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

    public AutoCloseable openScope() {
        ShortcutScope scope = new ShortcutScope(this);
        synchronized (scopes) {
            scopes.push(scope);
        }
        return scope;
    }

    private void recordChange(KeyStroke stroke, String previous) {
        ShortcutScope scope = currentScope();
        if (scope != null) {
            scope.record(stroke, previous);
        }
    }

    private ShortcutScope currentScope() {
        synchronized (scopes) {
            return scopes.peek();
        }
    }

    private void releaseScope(ShortcutScope scope) {
        boolean removed;
        synchronized (scopes) {
            removed = scopes.removeFirstOccurrence(scope);
        }
        if (removed) {
            scope.revert(descriptions);
        }
    }

    private static final class ShortcutScope implements AutoCloseable {
        private final AccessibleShortcutRegistry registry;
        private final List<Record> records = new ArrayList<>();
        private boolean closed;

        private ShortcutScope(AccessibleShortcutRegistry registry) {
            this.registry = registry;
        }

        private void record(KeyStroke stroke, String previous) {
            records.add(new Record(stroke, previous));
        }

        private void revert(Map<KeyStroke, String> target) {
            for (int i = records.size() - 1; i >= 0; i--) {
                Record record = records.get(i);
                if (record.previous() == null) {
                    target.remove(record.stroke());
                } else {
                    target.put(record.stroke(), record.previous());
                }
            }
            records.clear();
        }

        @Override
        public void close() {
            if (closed) {
                return;
            }
            closed = true;
            registry.releaseScope(this);
        }
    }

    private record Record(KeyStroke stroke, String previous) {
    }
}
