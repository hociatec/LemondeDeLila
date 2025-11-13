package com.lemondelila.client.presence.view;

import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.presence.model.PresencePlayer;

import javax.swing.JList;
import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;
import java.awt.Component;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Menu contextuel des joueurs connectés (messagerie, amis, blocage).
 */
final class PresencePlayerActionMenu {

    private final JPopupMenu menu = new JPopupMenu();
    private final JMenuItem messageItem = new JMenuItem("Envoyer un message privé");
    private final JMenuItem friendItem = new JMenuItem("Ajouter en tant qu'ami");
    private final JMenuItem blockItem = new JMenuItem("Bloquer");

    private final Consumer<PresencePlayer> onMessage;
    private final Consumer<PresencePlayer> onFriendToggle;
    private final Consumer<PresencePlayer> onBlockToggle;
    private final UserRelationshipService relationshipService;

    private PresencePlayer current;

    PresencePlayerActionMenu(JList<PresencePlayer> list,
                             Consumer<PresencePlayer> onMessage,
                             Consumer<PresencePlayer> onFriendToggle,
                             Consumer<PresencePlayer> onBlockToggle,
                             UserRelationshipService relationshipService) {
        this.onMessage = onMessage;
        this.onFriendToggle = onFriendToggle;
        this.onBlockToggle = onBlockToggle;
        this.relationshipService = relationshipService;

        messageItem.addActionListener(e -> {
            if (current != null) {
                onMessage.accept(current);
            }
        });
        friendItem.addActionListener(e -> {
            if (current != null) {
                onFriendToggle.accept(current);
            }
        });
        blockItem.addActionListener(e -> {
            if (current != null) {
                onBlockToggle.accept(current);
            }
        });

        menu.add(messageItem);
        menu.add(friendItem);
        menu.add(blockItem);
    }

    List<String> showAt(PresencePlayer player, Component anchor, int x, int y) {
        List<String> options = prepareFor(player);
        if (player != null) {
            menu.show(anchor, x, y);
        }
        return options;
    }

    private List<String> prepareFor(PresencePlayer player) {
        current = player;
        if (player == null) {
            disableAll();
            return List.of();
        }
        List<String> available = new ArrayList<>();
        boolean blocked = relationshipService.isBlocked(player.id());
        boolean friend = relationshipService.isFriend(player.id());

        messageItem.setEnabled(!blocked);
        if (messageItem.isEnabled()) {
            available.add(messageItem.getText());
        }

        friendItem.setEnabled(true);
        friendItem.setText(friend ? "Retirer des amis" : "Ajouter en tant qu'ami");
        available.add(friendItem.getText());

        blockItem.setEnabled(true);
        blockItem.setText(blocked ? "Débloquer" : "Bloquer");
        available.add(blockItem.getText());
        return available;
    }

    private void disableAll() {
        messageItem.setEnabled(false);
        friendItem.setEnabled(false);
        blockItem.setEnabled(false);
    }
}
