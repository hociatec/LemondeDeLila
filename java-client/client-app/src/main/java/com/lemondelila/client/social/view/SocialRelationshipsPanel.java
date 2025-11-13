package com.lemondelila.client.social.view;

import com.lemondelila.client.messaging.controller.MessagingController;
import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.messaging.service.UserRelationshipService.Relationship;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.DefaultListModel;
import javax.swing.JButton;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.KeyStroke;
import javax.swing.ListSelectionModel;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.GridLayout;
import java.awt.Window;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

final class SocialRelationshipsPanel extends JPanel {

    private final Window owner;
    private final UserRelationshipService relationshipService;
    private final MessagingController messagingController;
    private final Consumer<String> statusListener;

    private final DefaultListModel<Relationship> friendsModel = new DefaultListModel<>();
    private final DefaultListModel<Relationship> blockedModel = new DefaultListModel<>();

    private final JList<Relationship> friendsList = new JList<>(friendsModel);
    private final JList<Relationship> blockedList = new JList<>(blockedModel);
    private final JLabel statusLabel = new JLabel(" ");

    SocialRelationshipsPanel(Window owner,
                             UserRelationshipService relationshipService,
                             MessagingController messagingController,
                             Consumer<String> statusListener) {
        this.owner = Objects.requireNonNull(owner, "owner");
        this.relationshipService = Objects.requireNonNull(relationshipService, "relationshipService");
        this.messagingController = Objects.requireNonNull(messagingController, "messagingController");
        this.statusListener = Objects.requireNonNull(statusListener, "statusListener");
        buildUi();
        configureLists();
    }

    void reload() {
        friendsModel.clear();
        blockedModel.clear();
        List<Relationship> friends = relationshipService.friends();
        List<Relationship> blocked = relationshipService.blocked();
        friends.forEach(friendsModel::addElement);
        blocked.forEach(blockedModel::addElement);
        updateStatus(buildRelationshipsSummary(friends, blocked));
        statusListener.accept("Listes sociales mises à jour.");
    }

    private void buildUi() {
        setLayout(new BorderLayout(8, 8));

        JPanel lists = new JPanel(new GridLayout(1, 2, 8, 0));
        lists.add(buildFriendsPanel());
        lists.add(buildBlockedPanel());
        add(lists, BorderLayout.CENTER);

        statusLabel.setBorder(new EmptyBorder(4, 4, 4, 4));
        add(statusLabel, BorderLayout.SOUTH);
    }

    private JPanel buildFriendsPanel() {
        JPanel panel = new JPanel(new BorderLayout(4, 4));
        panel.setBorder(BorderFactory.createTitledBorder("Liste d'amis"));
        panel.add(new JScrollPane(friendsList), BorderLayout.CENTER);

        JPanel buttonBar = new JPanel();
        JButton refresh = new JButton("Actualiser");
        refresh.addActionListener(e -> reload());
        JButton openChat = new JButton("Ouvrir la messagerie");
        openChat.addActionListener(e -> openConversationFromFriend());
        JButton remove = new JButton("Retirer des amis");
        remove.addActionListener(e -> removeSelectedFriend());
        buttonBar.add(refresh);
        buttonBar.add(openChat);
        buttonBar.add(remove);
        panel.add(buttonBar, BorderLayout.SOUTH);
        return panel;
    }

    private JPanel buildBlockedPanel() {
        JPanel panel = new JPanel(new BorderLayout(4, 4));
        panel.setBorder(BorderFactory.createTitledBorder("Utilisateurs bloqués"));
        panel.add(new JScrollPane(blockedList), BorderLayout.CENTER);

        JPanel buttonBar = new JPanel();
        JButton unblock = new JButton("Débloquer");
        unblock.addActionListener(e -> unblockSelectedUser());
        buttonBar.add(unblock);
        panel.add(buttonBar, BorderLayout.SOUTH);
        return panel;
    }

    private void configureLists() {
        friendsList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        friendsList.setCellRenderer((list, value, index, isSelected, cellHasFocus) ->
                buildRelationshipCell(list, value, isSelected));
        friendsList.setFixedCellHeight(28);
        friendsList.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (SwingUtilities.isLeftMouseButton(e) && e.getClickCount() == 2) {
                    openConversationFromFriend();
                }
            }
        });
        friendsList.getInputMap().put(KeyStroke.getKeyStroke("ENTER"), "social.open-chat");
        friendsList.getActionMap().put("social.open-chat", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                openConversationFromFriend();
            }
        });

        blockedList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        blockedList.setCellRenderer((list, value, index, isSelected, cellHasFocus) ->
                buildRelationshipCell(list, value, isSelected));
        blockedList.setFixedCellHeight(28);
    }

    private void openConversationFromFriend() {
        Relationship relation = friendsList.getSelectedValue();
        if (relation == null) {
            statusListener.accept("Sélectionnez un ami pour démarrer une conversation.");
            return;
        }
        messagingController.openConversation(owner, relation.id(), relation.username());
        statusListener.accept("Conversation avec " + SocialDisplayUtils.displayName(relation) + " ouverte.");
    }

    private void removeSelectedFriend() {
        Relationship relation = friendsList.getSelectedValue();
        if (relation == null) {
            statusListener.accept("Aucun ami sélectionné.");
            return;
        }
        relationshipService.removeFriend(relation.id());
        reload();
        statusListener.accept(SocialDisplayUtils.displayName(relation) + " retiré de vos amis.");
    }

    private void unblockSelectedUser() {
        Relationship relation = blockedList.getSelectedValue();
        if (relation == null) {
            statusListener.accept("Aucun utilisateur bloqué sélectionné.");
            return;
        }
        relationshipService.unblock(relation.id());
        reload();
        statusListener.accept(SocialDisplayUtils.displayName(relation) + " est débloqué.");
    }

    private String buildRelationshipsSummary(List<Relationship> friends, List<Relationship> blocked) {
        StringBuilder builder = new StringBuilder();
        if (friends.isEmpty()) {
            builder.append("Aucun ami enregistré.");
        } else {
            builder.append(friends.size()).append(" ami(s) enregistré(s).");
        }
        if (!blocked.isEmpty()) {
            builder.append(" | ").append(blocked.size()).append(" utilisateur(s) bloqué(s).");
        }
        return builder.toString();
    }

    private void updateStatus(String message) {
        statusLabel.setText(message == null || message.isBlank() ? " " : message);
    }

    private static Component buildRelationshipCell(JList<?> list, Relationship relation, boolean isSelected) {
        JLabel label = new JLabel();
        if (relation != null) {
            String username = relation.username();
            if (username != null && !username.isBlank()) {
                label.setText(username + " (#" + relation.id() + ")");
            } else {
                label.setText("Utilisateur #" + relation.id());
            }
        } else {
            label.setText("");
        }
        if (isSelected) {
            label.setBackground(list.getSelectionBackground());
            label.setForeground(list.getSelectionForeground());
        } else {
            label.setBackground(list.getBackground());
            label.setForeground(list.getForeground());
        }
        label.setOpaque(true);
        label.setBorder(new EmptyBorder(4, 6, 4, 6));
        return label;
    }
}
