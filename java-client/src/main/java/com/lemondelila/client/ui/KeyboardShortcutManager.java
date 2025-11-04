package com.lemondelila.client.ui;

import javax.swing.*;
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
    private static final String F1_ACTION_KEY = "shortcut-f1-rules";

    private final Deque<Runnable> backStack = new ArrayDeque<>();
    private Runnable f1Action;

    public void install(JRootPane rootPane) {
        Objects.requireNonNull(rootPane, "rootPane");
        InputMap inputMap = rootPane.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap actionMap = rootPane.getActionMap();
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0), ESCAPE_ACTION_KEY);
        actionMap.put(ESCAPE_ACTION_KEY, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                triggerBackAction();
            }
        });
        inputMap.put(KeyStroke.getKeyStroke(KeyEvent.VK_F1, 0), F1_ACTION_KEY);
        actionMap.put(F1_ACTION_KEY, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (f1Action != null) {
                    f1Action.run();
                }
            }
        });
    }

    public void setF1Action(Runnable action) {
        this.f1Action = action;
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
