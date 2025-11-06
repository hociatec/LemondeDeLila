package com.lemondelila.client.ui.dialog;

import com.lemondelila.framework.ui.util.ButtonUtils;

import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.Window;

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
        yesButton.addActionListener(e -> confirm());
        noButton.addActionListener(e -> cancel());
        ButtonUtils.enterActivates(yesButton);
        ButtonUtils.enterActivates(noButton);

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

    public static boolean show(Window owner) {
        ConfirmExitDialog dialog = new ConfirmExitDialog(owner);
        dialog.setVisible(true);
        return dialog.confirmed;
    }
}

