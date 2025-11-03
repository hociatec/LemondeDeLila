package com.lemondelila.client.ui.dialog;

import javax.swing.*;
import java.awt.*;
import java.awt.event.KeyEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;

/**
 * Boîte de dialogue de confirmation réutilisable.
 */
public final class ConfirmationDialog {

    private ConfirmationDialog() {
        // Utility class
    }

    public static boolean show(Component parent,
                               String title,
                               String message,
                               String confirmLabel,
                               String cancelLabel) {
        Window owner = parent != null ? SwingUtilities.getWindowAncestor(parent) : null;
        final boolean[] confirmed = {false};

        JDialog dialog = new JDialog(owner, title, Dialog.ModalityType.APPLICATION_MODAL);
        dialog.setDefaultCloseOperation(WindowConstants.DISPOSE_ON_CLOSE);

        JPanel content = new JPanel(new BorderLayout(16, 16));
        content.setBorder(BorderFactory.createEmptyBorder(16, 16, 16, 16));
        content.add(new JLabel(message), BorderLayout.CENTER);

        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT, 12, 0));
        JButton confirmButton = new JButton(confirmLabel);
        JButton cancelButton = new JButton(cancelLabel);

        disableSpaceActivation(confirmButton);
        disableSpaceActivation(cancelButton);

        confirmButton.addActionListener(e -> {
            confirmed[0] = true;
            dialog.dispose();
        });
        cancelButton.addActionListener(e -> {
            confirmed[0] = false;
            dialog.dispose();
        });

        // Affiche le bouton de confirmation avant celui d'annulation
        buttonPanel.add(confirmButton);
        buttonPanel.add(cancelButton);
        content.add(buttonPanel, BorderLayout.SOUTH);

        dialog.setContentPane(content);
        dialog.getRootPane().setDefaultButton(cancelButton);
        installEscapeToCancel(dialog, cancelButton);

        dialog.addWindowListener(new WindowAdapter() {
            @Override
            public void windowOpened(WindowEvent e) {
                confirmButton.requestFocusInWindow();
            }
        });

        dialog.pack();
        dialog.setLocationRelativeTo(owner);
        dialog.setVisible(true);

        return confirmed[0];
    }

    private static void disableSpaceActivation(JButton button) {
        JComponent component = button;
        component.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("pressed SPACE"), "none");
        component.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("released SPACE"), "none");
        component.getActionMap().put("none", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                // ignore space key
            }
        });
    }

    private static void installEscapeToCancel(JDialog dialog, JButton cancelButton) {
        JComponent root = dialog.getRootPane();
        root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW)
                .put(KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0), "cancel-dialog");
        root.getActionMap().put("cancel-dialog", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                cancelButton.doClick();
            }
        });
    }
}
