package com.lemondelila.client.game.core.viewmodel;

import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.KeyStroke;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class GameShortcutBinder {

    @FunctionalInterface
    public interface InterfaceHandler {
        void handle(String id);
    }

    @FunctionalInterface
    public interface ActionHandler {
        void trigger(String actionType);
    }

    private final InputMap inputMap;
    private final ActionMap actionMap;
    private final Set<KeyStroke> registered = new HashSet<>();

    public GameShortcutBinder(InputMap inputMap, ActionMap actionMap) {
        this.inputMap = Objects.requireNonNull(inputMap, "inputMap");
        this.actionMap = Objects.requireNonNull(actionMap, "actionMap");
    }

    public void rebind(List<Map<String, Object>> shortcuts,
                       InterfaceHandler interfaceHandler,
                       ActionHandler actionHandler) {
        clear();
        if (shortcuts == null || shortcuts.isEmpty()) {
            return;
        }
        Objects.requireNonNull(interfaceHandler, "interfaceHandler");
        Objects.requireNonNull(actionHandler, "actionHandler");

        for (Map<String, Object> sc : shortcuts) {
            if (sc == null) continue;
            String key = String.valueOf(sc.getOrDefault("key", "")).trim();
            if (key.isBlank()) continue;
            String type = String.valueOf(sc.getOrDefault("type", "")).trim().toLowerCase();
            KeyStroke ks = KeyStroke.getKeyStroke(key);
            if (ks == null) continue;

            String actionName = "dyn." + ks;
            registered.add(ks);
            inputMap.put(ks, actionName);

            if ("interface".equals(type)) {
                String id = String.valueOf(sc.getOrDefault("id", "")).trim().toLowerCase();
                actionMap.put(actionName, new javax.swing.AbstractAction() {
                    @Override
                    public void actionPerformed(java.awt.event.ActionEvent e) {
                        interfaceHandler.handle(id);
                    }
                });
                continue;
            }

            if ("action".equals(type)) {
                String targetType = String.valueOf(sc.getOrDefault("actionType", "")).trim().toLowerCase();
                actionMap.put(actionName, new javax.swing.AbstractAction() {
                    @Override
                    public void actionPerformed(java.awt.event.ActionEvent e) {
                        if (targetType.isBlank()) return;
                        actionHandler.trigger(targetType);
                    }
                });
            }
        }
    }

    public void clear() {
        for (KeyStroke ks : registered) {
            inputMap.remove(ks);
            actionMap.remove("dyn." + ks);
        }
        registered.clear();
    }
}

