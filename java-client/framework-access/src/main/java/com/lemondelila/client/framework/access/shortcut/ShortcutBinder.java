package com.lemondelila.client.framework.access.shortcut;

import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

import static javax.swing.JComponent.WHEN_IN_FOCUSED_WINDOW;

/**
 * Utility that registers keyboard shortcuts across one or more components while keeping the
 * accessibility registry in sync. Guards can be provided to enable/disable actions on the fly.
 */
public final class ShortcutBinder {

    private final AccessibleShortcutRegistry shortcutRegistry;
    private final List<JComponent> targets;
    private final BooleanSupplier enabledSupplier;

    public ShortcutBinder(AccessibleShortcutRegistry shortcutRegistry,
                          BooleanSupplier enabledSupplier,
                          JComponent... components) {
        this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
        this.enabledSupplier = enabledSupplier != null ? enabledSupplier : () -> true;
        Objects.requireNonNull(components, "components");
        List<JComponent> resolved = new ArrayList<>();
        for (JComponent component : components) {
            if (component != null) {
                resolved.add(component);
            }
        }
        if (resolved.isEmpty()) {
            throw new IllegalArgumentException("At least one component must be provided.");
        }
        this.targets = Collections.unmodifiableList(resolved);
    }

    public void registerStroke(String keyStroke,
                               String actionId,
                               String description,
                               Consumer<ActionEvent> handler) {
        registerStroke(keyStroke, actionId, description, handler, null);
    }

    public void registerStroke(String keyStroke,
                               String actionId,
                               String description,
                               Consumer<ActionEvent> handler,
                               BooleanSupplier guard) {
        KeyStroke stroke = keyStroke == null ? null : KeyStroke.getKeyStroke(keyStroke);
        registerStroke(stroke, actionId, description, handler, guard);
    }

    public void registerStroke(KeyStroke stroke,
                               String actionId,
                               String description,
                               Consumer<ActionEvent> handler) {
        registerStroke(stroke, actionId, description, handler, null);
    }

    public void registerStroke(KeyStroke stroke,
                               String actionId,
                               String description,
                               Consumer<ActionEvent> handler,
                               BooleanSupplier guard) {
        if (stroke == null || actionId == null || handler == null) {
            return;
        }
        AbstractAction action = new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (!enabledSupplier.getAsBoolean()) {
                    return;
                }
                if (guard != null && !guard.getAsBoolean()) {
                    return;
                }
                handler.accept(e);
            }
        };
        for (JComponent component : targets) {
            component.getInputMap(WHEN_IN_FOCUSED_WINDOW).put(stroke, actionId);
            component.getActionMap().put(actionId, action);
        }
        registerDescription(stroke, description);
    }

    public void registerLetter(char letter,
                               String actionId,
                               String description,
                               Consumer<ActionEvent> handler) {
        registerLetter(letter, actionId, description, handler, null);
    }

    public void registerLetter(char letter,
                               String actionId,
                               String description,
                               Consumer<ActionEvent> handler,
                               BooleanSupplier guard) {
        char lower = Character.toLowerCase(letter);
        char upper = Character.toUpperCase(letter);
        registerStroke(KeyStroke.getKeyStroke(lower), actionId, description, handler, guard);
        if (upper != lower) {
            registerStroke(KeyStroke.getKeyStroke(upper), actionId, description, handler, guard);
        }
    }

    public void registerLetterDescription(char letter, String description) {
        if (description == null || description.isBlank()) {
            return;
        }
        char lower = Character.toLowerCase(letter);
        char upper = Character.toUpperCase(letter);
        registerDescription(KeyStroke.getKeyStroke(lower), description);
        if (upper != lower) {
            registerDescription(KeyStroke.getKeyStroke(upper), description);
        }
    }

    public void registerDescription(KeyStroke stroke, String description) {
        if (stroke == null || description == null || description.isBlank()) {
            return;
        }
        shortcutRegistry.register(stroke, description);
    }
}
