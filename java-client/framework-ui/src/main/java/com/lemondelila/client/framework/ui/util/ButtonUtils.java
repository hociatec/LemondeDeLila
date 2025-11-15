package com.lemondelila.client.framework.ui.util;

import javax.swing.AbstractAction;
import javax.swing.AbstractButton;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import java.awt.event.ActionEvent;

/**
 * Shared helpers to keep keyboard interactions consistent on Swing buttons.
 */
public final class ButtonUtils {

    private ButtonUtils() {
    }

    /**
     * Prevents the space bar from triggering the button while it has focus.
     */
    public static void disableSpace(AbstractButton button) {
        if (button == null) {
            return;
        }
        JComponent comp = button;
        comp.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("pressed SPACE"), "none");
        comp.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("released SPACE"), "none");
    }

    /**
     * Forces the button to react only to the Enter key when focused.
     */
    public static void enterActivates(AbstractButton button) {
        if (button == null) {
            return;
        }
        disableSpace(button);
        JComponent comp = button;
        comp.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "enter-press");
        comp.getActionMap().put("enter-press", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                button.doClick();
            }
        });
    }
}
