package com.lemondelila.client.presence.view;

import com.lemondelila.client.framework.ui.util.ButtonUtils;
import com.lemondelila.client.presence.model.PresencePlayer;

import javax.swing.DefaultListModel;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;

/**
 * Encapsule l'interface Swing de la fenêtre de présence.
 */
final class PresenceListView {

    private final DefaultListModel<PresencePlayer> model = new DefaultListModel<>();
    private final JList<PresencePlayer> list = new JList<>(model);
    private final JLabel statusLabel = new JLabel("Connexion au serveur...");
    private final JPanel contentPanel = new JPanel(new BorderLayout(8, 8));
    private final JPanel footerPanel = new JPanel();

    PresenceListView(Runnable onClose) {
        contentPanel.setBorder(new EmptyBorder(12, 12, 12, 12));
        contentPanel.add(new JLabel("Liste des joueurs connectés"), BorderLayout.NORTH);
        contentPanel.add(new JScrollPane(list), BorderLayout.CENTER);
        contentPanel.add(statusLabel, BorderLayout.SOUTH);

        JButton closeButton = new JButton("Fermer");
        ButtonUtils.enterActivates(closeButton);
        closeButton.addActionListener(e -> onClose.run());
        footerPanel.add(closeButton);
    }

    JPanel contentPanel() {
        return contentPanel;
    }

    JPanel footerPanel() {
        return footerPanel;
    }

    JList<PresencePlayer> list() {
        return list;
    }

    DefaultListModel<PresencePlayer> model() {
        return model;
    }

    void setStatus(String message) {
        String safe = (message == null || message.isBlank()) ? " " : message;
        statusLabel.setText(safe);
        if (statusLabel.getAccessibleContext() != null) {
            statusLabel.getAccessibleContext().setAccessibleDescription(safe);
        }
    }

    void setListEnabled(boolean enabled) {
        list.setEnabled(enabled);
        if (!enabled) {
            list.clearSelection();
        }
    }
}
