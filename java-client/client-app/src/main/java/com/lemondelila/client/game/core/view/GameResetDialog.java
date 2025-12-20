package com.lemondelila.client.game.core.view;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.KeyboardFocusManager;
import java.awt.Window;
import java.awt.event.ActionEvent;

public final class GameResetDialog {

    private GameResetDialog() {}

    public static boolean confirm(JComponent parent) {
        Window owner = parent == null ? null : SwingUtilities.getWindowAncestor(parent);
        if (owner == null && parent != null) {
            owner = javax.swing.JOptionPane.getFrameForComponent(parent);
        }
        final boolean[] confirmed = {false};

        JDialog dialog = new JDialog(owner, "Réinitialiser la partie", java.awt.Dialog.ModalityType.APPLICATION_MODAL);
        dialog.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);
        dialog.setResizable(false);
        dialog.setFocusTraversalKeysEnabled(false);
        dialog.getAccessibleContext().setAccessibleName("Réinitialiser la partie");
        dialog.getAccessibleContext().setAccessibleDescription("Confirmation de réinitialisation. Utilisez les flèches haut/bas ou Tab pour choisir Oui ou Non, puis Entrée.");

        JLabel label = new JLabel("<html>Réinitialiser la partie et revenir en préparation ?<br/><br/>Vous pourrez à nouveau ajouter/retirer des joueurs.</html>");
        javax.swing.JButton yes = new javax.swing.JButton("Oui");
        javax.swing.JButton no = new javax.swing.JButton("Non");
        label.getAccessibleContext().setAccessibleName("Confirmation");
        label.getAccessibleContext().setAccessibleDescription("Réinitialiser la partie et revenir en préparation. Vous pourrez à nouveau ajouter ou retirer des joueurs.");
        yes.getAccessibleContext().setAccessibleName("Oui");
        no.getAccessibleContext().setAccessibleName("Non");

        yes.addActionListener(e -> {
            confirmed[0] = true;
            dialog.dispose();
        });
        no.addActionListener(e -> dialog.dispose());

        javax.swing.JPanel buttons = new javax.swing.JPanel(new java.awt.FlowLayout(java.awt.FlowLayout.RIGHT, 8, 0));
        buttons.add(no);
        buttons.add(yes);

        javax.swing.JPanel content = new javax.swing.JPanel(new BorderLayout(8, 12));
        content.setBorder(javax.swing.BorderFactory.createEmptyBorder(12, 12, 12, 12));
        content.add(label, BorderLayout.CENTER);
        content.add(buttons, BorderLayout.SOUTH);
        dialog.setContentPane(content);
        dialog.getRootPane().setDefaultButton(yes);

        InputMap im = dialog.getRootPane().getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap am = dialog.getRootPane().getActionMap();
        Runnable focusYes = () -> {
            dialog.getRootPane().setDefaultButton(yes);
            yes.requestFocusInWindow();
        };
        Runnable focusNo = () -> {
            dialog.getRootPane().setDefaultButton(no);
            no.requestFocusInWindow();
        };
        am.put("reset.focus.next", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                KeyboardFocusManager.getCurrentKeyboardFocusManager().focusNextComponent();
            }
        });
        am.put("reset.focus.prev", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                KeyboardFocusManager.getCurrentKeyboardFocusManager().focusPreviousComponent();
            }
        });
        am.put("reset.choice.next", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (yes.isFocusOwner()) {
                    focusNo.run();
                } else {
                    focusYes.run();
                }
            }
        });
        am.put("reset.choice.prev", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (no.isFocusOwner()) {
                    focusYes.run();
                } else {
                    focusNo.run();
                }
            }
        });
        am.put("reset.cancel", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                dialog.dispose();
            }
        });
        im.put(KeyStroke.getKeyStroke("TAB"), "reset.focus.next");
        im.put(KeyStroke.getKeyStroke("shift TAB"), "reset.focus.prev");
        im.put(KeyStroke.getKeyStroke("UP"), "reset.choice.prev");
        im.put(KeyStroke.getKeyStroke("DOWN"), "reset.choice.next");
        im.put(KeyStroke.getKeyStroke("ESCAPE"), "reset.cancel");

        SwingUtilities.invokeLater(focusNo);
        dialog.pack();
        dialog.setLocationRelativeTo(owner);
        dialog.setVisible(true);
        return confirmed[0];
    }
}

