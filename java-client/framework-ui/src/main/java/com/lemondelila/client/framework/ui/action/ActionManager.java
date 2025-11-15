package com.lemondelila.client.framework.ui.action;

import javax.swing.AbstractAction;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.event.ActionEvent;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Gestion centralisée des actions Swing et de leurs raccourcis.
 */
public final class ActionManager {

    private final Map<String, AbstractAction> actions = new LinkedHashMap<>();
    private final Map<String, KeyStroke[]> shortcuts = new LinkedHashMap<>();

    public AbstractAction register(String id, ActionFactory factory, KeyStroke... keyStrokes) {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(factory, "factory");
        AbstractAction action = factory.create();
        actions.put(id, action);
        shortcuts.put(id, keyStrokes);
        return action;
    }

    public AbstractAction action(String id) {
        AbstractAction action = actions.get(id);
        if (action == null) {
            throw new IllegalArgumentException("Action introuvable: " + id);
        }
        return action;
    }

    public Map<String, KeyStroke[]> registeredShortcuts() {
        return Collections.unmodifiableMap(shortcuts);
    }

    public AutoCloseable attachTo(JComponent component) {
        Objects.requireNonNull(component, "component");
        InputMap inputMap = component.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        javax.swing.ActionMap actionMap = component.getActionMap();
        java.util.List<KeyBindingRecord> bindings = new java.util.ArrayList<>();
        java.util.Map<String, javax.swing.Action> previousActions = new java.util.LinkedHashMap<>();
        Runnable task = () -> shortcuts.forEach((id, keys) -> {
            AbstractAction action = actions.get(id);
            if (action == null) {
                return;
            }
            previousActions.put(id, actionMap.get(id));
            actionMap.put(id, new ShortcutAwareAction(id, action));
            for (KeyStroke key : keys) {
                if (key != null) {
                    Object previous = inputMap.get(key);
                    bindings.add(new KeyBindingRecord(key, previous));
                    inputMap.put(key, id);
                }
            }
        });
        if (SwingUtilities.isEventDispatchThread()) {
            task.run();
        } else {
            SwingUtilities.invokeLater(task);
        }
        return () -> SwingUtilities.invokeLater(() -> {
            bindings.forEach(binding -> {
                if (binding.previous == null) {
                    inputMap.remove(binding.key);
                } else {
                    inputMap.put(binding.key, binding.previous);
                }
            });
            previousActions.forEach((id, previous) -> {
                if (previous == null) {
                    actionMap.remove(id);
                } else {
                    actionMap.put(id, previous);
                }
            });
        });
    }

    public interface ActionFactory {
        AbstractAction create();
    }

    private record KeyBindingRecord(KeyStroke key, Object previous) {
    }

    private static final class ShortcutAwareAction extends AbstractAction {
        private final String id;
        private final AbstractAction delegate;

        private ShortcutAwareAction(String id, AbstractAction delegate) {
            super(id);
            this.id = id;
            this.delegate = delegate;
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            delegate.actionPerformed(e);
        }

        @Override
        public boolean isEnabled() {
            return delegate.isEnabled();
        }
    }
}

