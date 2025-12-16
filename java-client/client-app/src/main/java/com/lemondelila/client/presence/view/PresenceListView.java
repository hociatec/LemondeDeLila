package com.lemondelila.client.presence.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.presence.model.PresencePlayer;

import javax.swing.DefaultListModel;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;

/**
 * Encapsule l'interface Swing de la fenêtre de présence.
 */
public final class PresenceListView {

    private final DefaultListModel<PresencePlayer> model = new DefaultListModel<>();
    private final JList<PresencePlayer> list = new JList<>(model);
    private final JLabel statusLabel = new JLabel(Internationalization.text("presence.status.initial"));
    private final JLabel hintLabel = new JLabel(Internationalization.text("presence.dialog.hint"));
    private final JPanel contentPanel = new JPanel(new BorderLayout(8, 8));

    PresenceListView() {
        contentPanel.setBorder(new EmptyBorder(12, 12, 12, 12));
        contentPanel.add(buildHeader(), BorderLayout.NORTH);
        contentPanel.add(new JScrollPane(list), BorderLayout.CENTER);
        contentPanel.add(statusLabel, BorderLayout.SOUTH);
    }

    private JPanel buildHeader() {
        JPanel header = new JPanel(new BorderLayout());
        JLabel title = new JLabel(Internationalization.text("presence.dialog.title"));
        title.setFont(title.getFont().deriveFont(16f));
        header.add(title, BorderLayout.NORTH);
        hintLabel.setFont(hintLabel.getFont().deriveFont(Math.max(10f, hintLabel.getFont().getSize2D() - 2f)));
        header.add(hintLabel, BorderLayout.SOUTH);
        return header;
    }

    public JPanel contentPanel() {
        return contentPanel;
    }

    public JList<PresencePlayer> list() {
        return list;
    }

    public DefaultListModel<PresencePlayer> model() {
        return model;
    }

    public void setStatus(String message) {
        String safe = (message == null || message.isBlank()) ? " " : message;
        statusLabel.setText(safe);
        if (statusLabel.getAccessibleContext() != null) {
            statusLabel.getAccessibleContext().setAccessibleDescription(safe);
        }
    }

    public void setListEnabled(boolean enabled) {
        list.setEnabled(enabled);
        if (!enabled) {
            list.clearSelection();
        }
    }
}
