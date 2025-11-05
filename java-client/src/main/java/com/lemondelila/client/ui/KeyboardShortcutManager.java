package com.lemondelila.client.ui;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Objects;

/**
 * Gestion centralisee des raccourcis clavier de l'application.
 */
public final class KeyboardShortcutManager {

    private static final String ESCAPE_ACTION_KEY = "shortcut-escape-back";

    private final Deque<Runnable> backStack = new ArrayDeque<>();
    private JRootPane rootPane;

    public void install(JRootPane rootPane) {
        this.rootPane = Objects.requireNonNull(rootPane, "rootPane");
        InputMap inputMap = rootPane.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actionMap = rootPane.getActionMap();
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0), ESCAPE_ACTION_KEY);
        actionMap.put(ESCAPE_ACTION_KEY, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                triggerBackAction();
            }
        });
    }

    public void register(KeyStroke keyStroke, String key, Runnable action) {
        if (rootPane != null) {
            InputMap inputMap = rootPane.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
            ActionMap actionMap = rootPane.getActionMap();
            inputMap.put(keyStroke, key);
            actionMap.put(key, new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    action.run();
                }
            });
        }
    }

    public void pushBackAction(Runnable action) {
        if (action != null) {
            backStack.push(action);
        }
    }

    public void replaceBackAction(Runnable action) {
        backStack.clear();
        pushBackAction(action);
    }

    public void clearBackActions() {
        backStack.clear();
    }

    public void triggerBackAction() {
        Runnable action = backStack.pollFirst();
        if (action != null) {
            SwingUtilities.invokeLater(action);
        }
    }
}
