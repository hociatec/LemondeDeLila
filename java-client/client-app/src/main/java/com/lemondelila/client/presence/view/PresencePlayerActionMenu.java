package com.lemondelila.client.presence.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.presence.model.PresencePlayer;

import javax.swing.JMenuItem;
import javax.swing.JPopupMenu;
import java.awt.Component;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

/**
 * Menu contextuel des joueurs connectés (messagerie, amis, blocage).
 */
public final class PresencePlayerActionMenu {

    private final JPopupMenu menu = new JPopupMenu();
    private final JMenuItem messageItem = new JMenuItem(Internationalization.text("presence.menu.message"));
    private final JMenuItem friendItem = new JMenuItem(Internationalization.text("presence.menu.friend.add"));
    private final JMenuItem blockItem = new JMenuItem(Internationalization.text("presence.menu.block"));

    private final Consumer<PresencePlayer> onMessage;
    private final Consumer<PresencePlayer> onFriendToggle;
    private final Consumer<PresencePlayer> onBlockToggle;
    private final UserRelationshipService relationshipService;

    private PresencePlayer current;

    public PresencePlayerActionMenu(Consumer<PresencePlayer> onMessage,
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

    public List<String> showAt(PresencePlayer player, Component anchor, int x, int y) {
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
        friendItem.setText(friend
                ? Internationalization.text("presence.menu.friend.remove")
                : Internationalization.text("presence.menu.friend.add"));
        available.add(friendItem.getText());

        blockItem.setEnabled(true);
        blockItem.setText(blocked
                ? Internationalization.text("presence.menu.unblock")
                : Internationalization.text("presence.menu.block"));
        available.add(blockItem.getText());
        return available;
    }

    private void disableAll() {
        messageItem.setEnabled(false);
        friendItem.setEnabled(false);
        blockItem.setEnabled(false);
    }
}
