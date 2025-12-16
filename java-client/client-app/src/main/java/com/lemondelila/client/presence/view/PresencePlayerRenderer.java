package com.lemondelila.client.presence.view;

import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.presence.model.PresencePlayer;

import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.ListCellRenderer;
import javax.swing.border.EmptyBorder;
import java.awt.Component;

/**
 * Rend chaque joueur connecté avec les informations de relation.
 */
public final class PresencePlayerRenderer implements ListCellRenderer<PresencePlayer> {

    private final UserRelationshipService relationshipService;
    private final JLabel label = new JLabel();

    public PresencePlayerRenderer(UserRelationshipService relationshipService) {
        this.relationshipService = relationshipService;
    }

    @Override
    public Component getListCellRendererComponent(JList<? extends PresencePlayer> list,
                                                  PresencePlayer value,
                                                  int index,
                                                  boolean isSelected,
                                                  boolean cellHasFocus) {
        if (value == null) {
            label.setText("");
        } else {
            String roomInfo = value.currentRoom() == null
                    ? ""
                    : " [" + value.currentRoom().name() + "]";
            StringBuilder text = new StringBuilder(value.username()).append(roomInfo);
            if (relationshipService.isFriend(value.id())) {
                text.append(" ★");
            }
            if (relationshipService.isBlocked(value.id())) {
                text.append(" (bloqué)");
            }
            label.setText(text.toString());
        }
        if (isSelected) {
            label.setBackground(list.getSelectionBackground());
            label.setForeground(list.getSelectionForeground());
        } else {
            label.setBackground(list.getBackground());
            label.setForeground(list.getForeground());
        }
        label.setOpaque(true);
        label.setBorder(new EmptyBorder(4, 4, 4, 4));
        return label;
    }
}
