package com.lemondelila.client.game.core.viewmodel;

import org.junit.jupiter.api.Test;

import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JComponent;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class GameShortcutBinderTest {

    @Test
    void rebind_registersAndClears() {
        InputMap inputMap = new InputMap();
        ActionMap actionMap = new ActionMap();
        GameShortcutBinder binder = new GameShortcutBinder(inputMap, actionMap);

        AtomicReference<String> iface = new AtomicReference<>();
        AtomicReference<String> act = new AtomicReference<>();

        binder.rebind(
                List.of(
                        Map.of("key", "F1", "type", "interface", "id", "shopping"),
                        Map.of("key", "F2", "type", "action", "actionType", "roll")
                ),
                iface::set,
                act::set
        );

        Object a1 = inputMap.get(javax.swing.KeyStroke.getKeyStroke("F1"));
        assertNotNull(a1);
        ((javax.swing.Action) actionMap.get(a1)).actionPerformed(null);
        assertEquals("shopping", iface.get());

        Object a2 = inputMap.get(javax.swing.KeyStroke.getKeyStroke("F2"));
        assertNotNull(a2);
        ((javax.swing.Action) actionMap.get(a2)).actionPerformed(null);
        assertEquals("roll", act.get());

        binder.clear();
        assertNull(inputMap.get(javax.swing.KeyStroke.getKeyStroke("F1")));
        assertNull(inputMap.get(javax.swing.KeyStroke.getKeyStroke("F2")));
        assertNull(actionMap.get(a1));
        assertNull(actionMap.get(a2));
    }
}

