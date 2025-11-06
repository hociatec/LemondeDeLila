package com.lemondelila.client.ui.dialog;

import javax.swing.AbstractAction;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.awt.event.KeyEvent;

public final class ConfirmExitDialog extends JDialog {

    private boolean confirmed;

    private ConfirmExitDialog(Window owner) {
        super(owner, "Quitter l'application", ModalityType.APPLICATION_MODAL);
        setDefaultCloseOperation(DO_NOTHING_ON_CLOSE);
        setLayout(new BorderLayout(12, 12));
        JLabel label = new JLabel("Voulez-vous vraiment quitter Le Monde de Lila ?");
        label.setBorder(new EmptyBorder(16, 16, 0, 16));
        add(label, BorderLayout.CENTER);

        JButton yesButton = new JButton("Oui");
        JButton noButton = new JButton("Non");
        enableEnterOnly(yesButton, this::confirm);
        enableEnterOnly(noButton, this::cancel);

        JPanel buttonPanel = new JPanel();
        buttonPanel.setBorder(new EmptyBorder(0, 0, 16, 0));
        buttonPanel.add(yesButton);
        buttonPanel.add(noButton);
        add(buttonPanel, BorderLayout.SOUTH);

        pack();
        setLocationRelativeTo(owner);
        SwingUtilities.invokeLater(noButton::requestFocusInWindow);
    }

    private void confirm() {
        confirmed = true;
        dispose();
    }

    private void cancel() {
        confirmed = false;
        dispose();
    }

    private void enableEnterOnly(JButton button, Runnable action) {
        button.addActionListener(e -> action.run());
        InputMapUtils.disableSpace(button);
        InputMapUtils.bindEnter(button, action);
    }

    public static boolean show(Window owner) {
        ConfirmExitDialog dialog = new ConfirmExitDialog(owner);
        dialog.setVisible(true);
        return dialog.confirmed;
    }

    private static final class InputMapUtils {
        private static void disableSpace(JButton button) {
            JComponent comp = button;
            comp.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("pressed SPACE"), "none");
            comp.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("released SPACE"), "none");
        }

        private static void bindEnter(JButton button, Runnable action) {
            JComponent comp = button;
            KeyStroke enter = KeyStroke.getKeyStroke(KeyEvent.VK_ENTER, 0);
            comp.getInputMap(JComponent.WHEN_FOCUSED).put(enter, "enter-press");
            comp.getActionMap().put("enter-press", new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    action.run();
                }
            });
        }
    }
}
