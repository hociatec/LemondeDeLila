package com.lemondelila.client.game.core.view;

/**
 * Dialogues génériques pour les écrans de jeu.
 */
public final class GameDialog {

    private GameDialog() {
    }

    public static boolean confirm(java.awt.Component parent, String title, String message) {
        javax.swing.JButton yesButton = new javax.swing.JButton("Oui");
        yesButton.setMnemonic(java.awt.event.KeyEvent.VK_O);
        javax.swing.JButton noButton = new javax.swing.JButton("Non");
        noButton.setMnemonic(java.awt.event.KeyEvent.VK_N);
        bindTabNavigation(yesButton, noButton);
        bindTabNavigation(noButton, yesButton);
        java.util.concurrent.atomic.AtomicBoolean confirmed = new java.util.concurrent.atomic.AtomicBoolean(false);

        final Object[] options = { yesButton, noButton };
        final javax.swing.JOptionPane pane = new javax.swing.JOptionPane(
                message,
                javax.swing.JOptionPane.QUESTION_MESSAGE,
                javax.swing.JOptionPane.YES_NO_OPTION,
                null,
                options,
                noButton);

        yesButton.addActionListener(e -> {
            confirmed.set(true);
            pane.setValue(yesButton);
        });
        noButton.addActionListener(e -> {
            confirmed.set(false);
            pane.setValue(noButton);
        });

        java.awt.KeyboardFocusManager.getCurrentKeyboardFocusManager().clearGlobalFocusOwner();
        final javax.swing.JDialog dialog = pane.createDialog(parent, title);
        dialog.setModal(true);
        dialog.setFocusable(true);
        dialog.setFocusTraversalKeysEnabled(true);
        dialog.getRootPane().setDefaultButton(null);

        dialog.addWindowListener(new java.awt.event.WindowAdapter() {
            @Override
            public void windowClosed(java.awt.event.WindowEvent e) {
                if (pane.getValue() == javax.swing.JOptionPane.UNINITIALIZED_VALUE) {
                    confirmed.set(false);
                    pane.setValue(noButton);
                }
            }
        });

        dialog.addWindowFocusListener(new java.awt.event.WindowAdapter() {
            @Override
            public void windowGainedFocus(java.awt.event.WindowEvent e) {
                yesButton.requestFocusInWindow();
            }
        });

        bindEnterClick(yesButton);
        bindEnterClick(noButton);

        dialog.pack();
        dialog.setVisible(true);
        dialog.dispose();
        return confirmed.get();
    }

    private static void bindTabNavigation(javax.swing.JButton source, javax.swing.JButton target) {
        source.setFocusTraversalKeysEnabled(false);
        javax.swing.InputMap im = source.getInputMap(javax.swing.JComponent.WHEN_FOCUSED);
        javax.swing.ActionMap am = source.getActionMap();
        im.put(javax.swing.KeyStroke.getKeyStroke("DOWN"), "moveNext");
        im.put(javax.swing.KeyStroke.getKeyStroke("UP"), "movePrev");
        javax.swing.AbstractAction action = new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                target.requestFocusInWindow();
            }
        };
        am.put("moveNext", action);
        am.put("movePrev", action);
    }

    private static void bindEnterClick(javax.swing.JButton button) {
        javax.swing.InputMap im = button.getInputMap(javax.swing.JComponent.WHEN_FOCUSED);
        javax.swing.ActionMap am = button.getActionMap();
        im.put(javax.swing.KeyStroke.getKeyStroke("ENTER"), "dialog.enter.click");
        am.put("dialog.enter.click", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                button.doClick();
            }
        });
    }
}
