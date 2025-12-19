package com.lemondelila.client.game.core.view;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.KeyStroke;
import java.awt.event.ActionEvent;
import java.util.Objects;

public final class KeyboardEventRouter {

    private final InputMap inputMap;
    private final ActionMap actionMap;

    public KeyboardEventRouter(InputMap inputMap, ActionMap actionMap) {
        this.inputMap = Objects.requireNonNull(inputMap, "inputMap");
        this.actionMap = Objects.requireNonNull(actionMap, "actionMap");
    }

    public void bind(String keyStroke, String actionId, Runnable handler) {
        bind(KeyStroke.getKeyStroke(keyStroke), actionId, handler);
    }

    public void bind(KeyStroke keyStroke, String actionId, Runnable handler) {
        Objects.requireNonNull(keyStroke, "keyStroke");
        Objects.requireNonNull(actionId, "actionId");
        Objects.requireNonNull(handler, "handler");
        inputMap.put(keyStroke, actionId);
        actionMap.put(actionId, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                handler.run();
            }
        });
    }
}

