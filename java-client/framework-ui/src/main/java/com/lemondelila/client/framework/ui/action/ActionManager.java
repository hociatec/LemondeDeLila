package com.lemondelila.client.framework.ui.action;

import javax.swing.AbstractAction;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.event.ActionEvent;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Gestion centralisée des actions Swing et de leurs raccourcis.
 */
public final class ActionManager {

    private final Map<String, AbstractAction> actions = new LinkedHashMap<>();
    private final Map<String, KeyStroke[]> shortcuts = new LinkedHashMap<>();
    private final Deque<ActionScope> scopes = new ArrayDeque<>();

    public AbstractAction register(String id, ActionFactory factory, KeyStroke... keyStrokes) {
        Objects.requireNonNull(id, "id");
        Objects.requireNonNull(factory, "factory");
        AbstractAction action = factory.create();
        AbstractAction previousAction = actions.put(id, action);
        KeyStroke[] previousShortcuts = shortcuts.put(id, keyStrokes);
        recordRegistration(id, previousAction, previousShortcuts);
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
        List<KeyBindingRecord> bindings = new ArrayList<>();
        Map<String, javax.swing.Action> previousActions = new LinkedHashMap<>();
        Runnable task = () -> shortcuts.forEach((id, keys) -> {
            AbstractAction action = actions.get(id);
            if (action == null) {
                return;
            }
            previousActions.put(id, actionMap.get(id));
            actionMap.put(id, new ShortcutAwareAction(id, this));
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

    public AutoCloseable openScope() {
        ActionScope scope = new ActionScope(this);
        synchronized (scopes) {
            scopes.push(scope);
        }
        return scope;
    }

    private AbstractAction findAction(String id) {
        return actions.get(id);
    }

    private void recordRegistration(String id, AbstractAction previousAction, KeyStroke[] previousShortcuts) {
        ActionScope scope = currentScope();
        if (scope != null) {
            scope.record(id, previousAction, previousShortcuts);
        }
    }

    private ActionScope currentScope() {
        synchronized (scopes) {
            return scopes.peek();
        }
    }

    private void releaseScope(ActionScope scope) {
        boolean removed;
        synchronized (scopes) {
            removed = scopes.removeFirstOccurrence(scope);
        }
        if (removed) {
            scope.dispose();
        }
    }

    public interface ActionFactory {
        AbstractAction create();
    }

    private record KeyBindingRecord(KeyStroke key, Object previous) {
    }

    private static final class ShortcutAwareAction extends AbstractAction {
        private final String id;
        private final ActionManager manager;

        private ShortcutAwareAction(String id, ActionManager manager) {
            super(id);
            this.id = id;
            this.manager = manager;
        }

        @Override
        public void actionPerformed(ActionEvent e) {
            AbstractAction delegate = manager.findAction(id);
            if (delegate != null) {
                delegate.actionPerformed(e);
            }
        }

        @Override
        public boolean isEnabled() {
            AbstractAction delegate = manager.findAction(id);
            return delegate != null && delegate.isEnabled();
        }
    }

    private void restoreSnapshot(ActionSnapshot snapshot) {
        if (snapshot.previousAction() == null) {
            actions.remove(snapshot.id());
            shortcuts.remove(snapshot.id());
        } else {
            actions.put(snapshot.id(), snapshot.previousAction());
            if (snapshot.previousShortcuts() == null) {
                shortcuts.remove(snapshot.id());
            } else {
                shortcuts.put(snapshot.id(), snapshot.previousShortcuts());
            }
        }
    }

    private record ActionSnapshot(String id, AbstractAction previousAction, KeyStroke[] previousShortcuts) {
    }

    private static final class ActionScope implements AutoCloseable {
        private final ActionManager manager;
        private final List<ActionSnapshot> registrations = new ArrayList<>();
        private boolean closed;

        private ActionScope(ActionManager manager) {
            this.manager = manager;
        }

        private void record(String id, AbstractAction previousAction, KeyStroke[] previousShortcuts) {
            registrations.add(new ActionSnapshot(id, previousAction, previousShortcuts));
        }

        private void dispose() {
            for (int i = registrations.size() - 1; i >= 0; i--) {
                manager.restoreSnapshot(registrations.get(i));
            }
            registrations.clear();
        }

        @Override
        public void close() {
            if (closed) {
                return;
            }
            closed = true;
            manager.releaseScope(this);
        }
    }
}
