package com.lemondelila.client.presence.view;

import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.presence.model.PresencePlayer;
import com.lemondelila.client.presence.model.PresenceStatusFormatter;

import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.ListCellRenderer;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Font;

/**
 * Rend chaque joueur connecté avec les informations de relation.
 */
public final class PresencePlayerRenderer implements ListCellRenderer<PresencePlayer> {

    private static final Color SUBTEXT_COLOR = new Color(90, 90, 90);

    private final UserRelationshipService relationshipService;
    private final JPanel container = new JPanel(new BorderLayout(0, 2));
    private final JLabel nameLabel = new JLabel();
    private final JLabel statusLabel = new JLabel();

    public PresencePlayerRenderer(UserRelationshipService relationshipService) {
        this.relationshipService = relationshipService;
        container.setBorder(new EmptyBorder(6, 8, 6, 8));
        container.setOpaque(true);
        container.add(nameLabel, BorderLayout.NORTH);
        container.add(statusLabel, BorderLayout.CENTER);
        Font base = nameLabel.getFont();
        nameLabel.setFont(base.deriveFont(Font.BOLD));
        statusLabel.setFont(base.deriveFont(Math.max(10f, base.getSize2D() - 1f)));
        statusLabel.setForeground(SUBTEXT_COLOR);
    }

    @Override
    public Component getListCellRendererComponent(JList<? extends PresencePlayer> list,
                                                  PresencePlayer value,
                                                  int index,
                                                  boolean isSelected,
                                                  boolean cellHasFocus) {
        if (value == null) {
            nameLabel.setText("");
            statusLabel.setText("");
            applyAccessibleText("");
        } else {
            String status = PresenceStatusFormatter.describe(value);
            StringBuilder text = new StringBuilder(value.username());
            if (relationshipService.isFriend(value.id())) {
                text.append(" ★");
            }
            if (relationshipService.isBlocked(value.id())) {
                text.append(" (bloqué)");
            }
            nameLabel.setText(text.toString());
            statusLabel.setText(status);
            statusLabel.setVisible(!status.isBlank());
            applyAccessibleText(status.isBlank()
                    ? text.toString()
                    : text + " - " + status);
        }
        Color bg = isSelected ? list.getSelectionBackground() : list.getBackground();
        Color fg = isSelected ? list.getSelectionForeground() : list.getForeground();
        container.setBackground(bg);
        nameLabel.setForeground(fg);
        statusLabel.setForeground(isSelected ? fg : SUBTEXT_COLOR);
        nameLabel.setOpaque(false);
        statusLabel.setOpaque(false);
        return container;
    }

    private void applyAccessibleText(String text) {
        if (text == null) {
            text = "";
        }
        if (container.getAccessibleContext() != null) {
            container.getAccessibleContext().setAccessibleName(text);
            container.getAccessibleContext().setAccessibleDescription(text);
        }
        if (nameLabel.getAccessibleContext() != null) {
            nameLabel.getAccessibleContext().setAccessibleName(text);
            nameLabel.getAccessibleContext().setAccessibleDescription(text);
        }
        if (statusLabel.getAccessibleContext() != null) {
            statusLabel.getAccessibleContext().setAccessibleName(text);
            statusLabel.getAccessibleContext().setAccessibleDescription(text);
        }
    }
}
