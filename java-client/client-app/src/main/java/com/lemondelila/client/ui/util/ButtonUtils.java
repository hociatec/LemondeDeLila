package com.lemondelila.client.ui.util;

import javax.swing.AbstractAction;
import javax.swing.AbstractButton;
import javax.swing.JComponent;
import javax.swing.KeyStroke;
import java.awt.event.ActionEvent;

/**
 * Helpers to keep keyboard interactions cohérents dans tout le client.
 */
public final class ButtonUtils {

    private ButtonUtils() {
    }

    /**
     * Empêche la barre espace de déclencher le bouton.
     */
    public static void disableSpace(AbstractButton button) {
        if (button == null) return;
        JComponent comp = button;
        comp.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("pressed SPACE"), "none");
        comp.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("released SPACE"), "none");
    }

    /**
     * Force le bouton à n'être validé qu'avec Entrée (les autres touches sont ignorées).
     */
    public static void enterActivates(AbstractButton button) {
        if (button == null) return;
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
