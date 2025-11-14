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

    public void attachTo(JComponent component) {
        SwingUtilities.invokeLater(() -> shortcuts.forEach((id, keys) -> {
            AbstractAction action = actions.get(id);
            if (action == null) {
                return;
            }
            InputMap inputMap = component.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
            for (KeyStroke key : keys) {
                if (key != null) {
                    inputMap.put(key, id);
                    component.getActionMap().put(id, new ShortcutAwareAction(id, action));
                }
            }
        }));
    }

    public interface ActionFactory {
        AbstractAction create();
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

