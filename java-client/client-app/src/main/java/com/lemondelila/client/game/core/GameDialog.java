package com.lemondelila.client.game.core;

import javax.swing.AbstractAction;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.FlowLayout;
import java.awt.event.ActionEvent;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Boites de dialogue simples avec navigation clavier maitrisee.
 */
public final class GameDialog {

    private GameDialog() {
    }

    /**
     * Affiche une confirmation Oui/Non avec navigation Tab/Maj+Tab entre les boutons.
     */
    public static boolean confirm(Component parent, String title, String message) {
        AtomicBoolean result = new AtomicBoolean(false);

        JDialog dialog = new JDialog();
        dialog.setModal(true);
        dialog.setTitle(title == null ? "" : title);
        dialog.setLayout(new BorderLayout(8, 8));
        dialog.add(new JLabel(message == null ? "" : message), BorderLayout.CENTER);

        JButton yes = new JButton("Oui");
        JButton no = new JButton("Non");

        FlowLayout layout = new FlowLayout(FlowLayout.RIGHT, 8, 8);
        JPanel buttons = new JPanel(layout);
        buttons.add(no);
        buttons.add(yes);
        dialog.add(buttons, BorderLayout.SOUTH);

        yes.addActionListener(e -> {
            result.set(true);
            dialog.dispose();
        });
        no.addActionListener(e -> {
            result.set(false);
            dialog.dispose();
        });

        bindCycle(yes, no);
        bindCycle(no, yes);
        bindEnter(yes);
        bindEnter(no);
        yes.requestFocusInWindow();

        dialog.pack();
        dialog.setLocationRelativeTo(parent);
        dialog.setResizable(false);
        dialog.setVisible(true);
        return result.get();
    }

    private static void bindCycle(JComponent source, JComponent target) {
        source.setFocusTraversalKeysEnabled(false);
        source.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("TAB"), "next");
        source.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("shift TAB"), "prev");
        source.getActionMap().put("next", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                target.requestFocusInWindow();
            }
        });
        source.getActionMap().put("prev", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                target.requestFocusInWindow();
            }
        });
    }

    private static void bindEnter(JButton button) {
        InputMap map = button.getInputMap(JComponent.WHEN_FOCUSED);
        ActionMap actions = button.getActionMap();
        map.put(KeyStroke.getKeyStroke("ENTER"), "press");
        actions.put("press", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                button.doClick();
            }
        });
    }
}
