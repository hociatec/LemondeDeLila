package com.lemondelila.client.social.view;

import com.lemondelila.client.messaging.service.UserRelationshipService;
import com.lemondelila.client.messaging.service.UserRelationshipService.Relationship;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.DefaultListModel;
import javax.swing.InputMap;
import javax.swing.ActionMap;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.ListSelectionModel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import javax.swing.event.ListSelectionListener;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.KeyboardFocusManager;
import java.awt.event.ActionEvent;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

final class SocialRelationshipsPanel extends JPanel {

    private final UserRelationshipService relationshipService;
    private final Consumer<String> statusListener;

    private final DefaultListModel<Relationship> friendsModel = new DefaultListModel<>();
    private final DefaultListModel<Relationship> blockedModel = new DefaultListModel<>();

    private final JList<Relationship> friendsList = new JList<>(friendsModel);
    private final JList<Relationship> blockedList = new JList<>(blockedModel);

    private final JLabel statusLabel = new JLabel(" ");

    private final CardLayout contentLayout = new CardLayout();
    private final JPanel contentPanel = new JPanel(contentLayout);

    private JButton[] menuButtons;
    private Font menuBaseFont;
    private Font menuSelectedFont;

    private JButton removeFriendButton;
    private JButton unblockButton;
    private Runnable onEscape;

    private int activeSection = SECTION_FRIENDS;

    private static final int SECTION_FRIENDS = 0;
    private static final int SECTION_BLOCKED = 1;
    private static final String[] SECTION_TITLES = {
            "Liste d'amis",
            "Utilisateurs bloqués"
    };

    SocialRelationshipsPanel(UserRelationshipService relationshipService,
                             Consumer<String> statusListener) {
        this.relationshipService = Objects.requireNonNull(relationshipService, "relationshipService");
        this.statusListener = Objects.requireNonNull(statusListener, "statusListener");
        buildUi();
        configureLists();
        showSection(activeSection, false);
    }

    void focusFriendsList() {
        focusList(friendsList);
    }

    void reload() {
        friendsModel.clear();
        blockedModel.clear();
        List<Relationship> friends = relationshipService.friends();
        List<Relationship> blocked = relationshipService.blocked();
        friends.forEach(friendsModel::addElement);
        blocked.forEach(blockedModel::addElement);
        updateMenuLabels();
        updateStatus(buildRelationshipsSummary(friends, blocked));
        updateControls();
        updateAccessibility();
    }

    void focusMenu() {
        if (menuButtons != null && menuButtons.length > 0) {
            SwingUtilities.invokeLater(() -> menuButtons[activeSection].requestFocusInWindow());
        }
    }

    void setOnEscape(Runnable onEscape) {
        this.onEscape = onEscape;
    }

    private void buildUi() {
        setLayout(new BorderLayout(8, 8));
        add(buildMenuPanel(), BorderLayout.NORTH);
        contentPanel.add(buildFriendsContent(), sectionKey(SECTION_FRIENDS));
        contentPanel.add(buildBlockedContent(), sectionKey(SECTION_BLOCKED));
        add(contentPanel, BorderLayout.CENTER);
        statusLabel.setBorder(new EmptyBorder(4, 4, 4, 4));
        add(statusLabel, BorderLayout.SOUTH);
        installEscapeBinding(this);
        installEscapeBinding(contentPanel);
    }

    private JPanel buildMenuPanel() {
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));
        panel.setBorder(new EmptyBorder(8, 8, 8, 8));

        JLabel title = new JLabel("Section Amis");
        title.setFont(title.getFont().deriveFont(Font.BOLD, 16f));
        panel.add(title);
        panel.add(Box.createVerticalStrut(6));

        JPanel buttonsWrapper = new JPanel();
        buttonsWrapper.setLayout(new BoxLayout(buttonsWrapper, BoxLayout.Y_AXIS));

        menuButtons = new JButton[SECTION_TITLES.length];
        for (int i = 0; i < SECTION_TITLES.length; i++) {
            final int index = i;
            JButton button = new JButton(SECTION_TITLES[i]);
            if (menuBaseFont == null) {
                menuBaseFont = button.getFont();
                menuSelectedFont = menuBaseFont.deriveFont(Font.BOLD);
            }
            button.addActionListener(e -> showSection(index, true));
            button.getAccessibleContext().setAccessibleName(SECTION_TITLES[i]);
            button.getAccessibleContext().setAccessibleDescription("Aller à " + SECTION_TITLES[i]);
            customiseButtonNavigation(button, index, menuButtons);
            menuButtons[i] = button;
            buttonsWrapper.add(button);
            if (i < SECTION_TITLES.length - 1) {
                buttonsWrapper.add(Box.createVerticalStrut(6));
            }
        }
        panel.add(buttonsWrapper);
        installEscapeBinding(panel);
        updateMenuLabels();
        updateMenuButtons();
        return panel;
    }

    private JPanel buildFriendsContent() {
        JPanel panel = new JPanel(new BorderLayout(4, 4));
        panel.setBorder(BorderFactory.createTitledBorder("Liste d'amis"));
        JScrollPane scroll = new JScrollPane(friendsList);
        panel.add(scroll, BorderLayout.CENTER);

        JPanel footer = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        removeFriendButton = new JButton("Retirer des amis");
        removeFriendButton.addActionListener(e -> removeSelectedFriend());
        footer.add(removeFriendButton);
        panel.add(footer, BorderLayout.SOUTH);
        installEscapeBinding(panel);
        return panel;
    }

    private JPanel buildBlockedContent() {
        JPanel panel = new JPanel(new BorderLayout(4, 4));
        panel.setBorder(BorderFactory.createTitledBorder("Utilisateurs bloqués"));
        JScrollPane scroll = new JScrollPane(blockedList);
        panel.add(scroll, BorderLayout.CENTER);

        JPanel footer = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        unblockButton = new JButton("Débloquer");
        unblockButton.addActionListener(e -> unblockSelectedUser());
        footer.add(unblockButton);
        panel.add(footer, BorderLayout.SOUTH);
        installEscapeBinding(panel);
        return panel;
    }

    private void configureLists() {
        friendsList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        friendsList.setCellRenderer((list, value, index, isSelected, cellHasFocus) ->
                buildRelationshipCell(list, value, isSelected));
        friendsList.setFixedCellHeight(28);
        friendsList.addListSelectionListener(createSelectionListener());

        blockedList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        blockedList.setCellRenderer((list, value, index, isSelected, cellHasFocus) ->
                buildRelationshipCell(list, value, isSelected));
        blockedList.setFixedCellHeight(28);
        blockedList.addListSelectionListener(createSelectionListener());
    }

    private ListSelectionListener createSelectionListener() {
        return event -> {
            if (!event.getValueIsAdjusting()) {
                updateControls();
            }
        };
    }

    private void showSection(int section, boolean focusContent) {
        if (menuButtons == null || menuButtons.length == 0) {
            return;
        }
        int clamped = Math.max(0, Math.min(menuButtons.length - 1, section));
        activeSection = clamped;
        contentLayout.show(contentPanel, sectionKey(activeSection));
        updateMenuButtons();
        updateControls();
        if (!focusContent) {
            return;
        }
        switch (activeSection) {
            case SECTION_FRIENDS -> focusList(friendsList);
            case SECTION_BLOCKED -> focusList(blockedList);
            default -> {
            }
        }
    }

    private void updateMenuButtons() {
        if (menuButtons == null) {
            return;
        }
        for (int i = 0; i < menuButtons.length; i++) {
            JButton button = menuButtons[i];
            boolean active = (i == activeSection);
            if (menuBaseFont != null && menuSelectedFont != null) {
                button.setFont(active ? menuSelectedFont : menuBaseFont);
            }
            button.getAccessibleContext().setAccessibleDescription(
                    active
                            ? SECTION_TITLES[i] + " sélectionné."
                            : "Aller à " + SECTION_TITLES[i]
            );
        }
    }

    private void updateMenuLabels() {
        if (menuButtons == null) {
            return;
        }
        menuButtons[SECTION_FRIENDS].setText("Liste d'amis (" + friendsModel.size() + ")");
        menuButtons[SECTION_BLOCKED].setText("Utilisateurs bloqués (" + blockedModel.size() + ")");
    }

    private void customiseButtonNavigation(JButton button, int index, JButton[] group) {
        button.setFocusTraversalKeys(KeyboardFocusManager.FORWARD_TRAVERSAL_KEYS, Collections.emptySet());
        button.setFocusTraversalKeys(KeyboardFocusManager.BACKWARD_TRAVERSAL_KEYS, Collections.emptySet());
        InputMap map = button.getInputMap(JComponent.WHEN_FOCUSED);
        ActionMap actions = button.getActionMap();

        map.put(KeyStroke.getKeyStroke("UP"), "nav.up");
        map.put(KeyStroke.getKeyStroke("DOWN"), "nav.down");
        actions.put("nav.up", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                int previous = (index - 1 + group.length) % group.length;
                group[previous].requestFocusInWindow();
            }
        });
        actions.put("nav.down", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                int next = (index + 1) % group.length;
                group[next].requestFocusInWindow();
            }
        });
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
        focusList(friendsList);
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
        focusList(blockedList);
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

    private void updateControls() {
        if (removeFriendButton != null) {
            removeFriendButton.setEnabled(activeSection == SECTION_FRIENDS && friendsList.getSelectedValue() != null);
        }
        if (unblockButton != null) {
            unblockButton.setEnabled(activeSection == SECTION_BLOCKED && blockedList.getSelectedValue() != null);
        }
    }

    private void updateAccessibility() {
        String friendsDescription = friendsModel.isEmpty()
                ? "Aucun ami enregistré."
                : friendsModel.size() + " ami(s) enregistré(s).";
        String blockedDescription = blockedModel.isEmpty()
                ? "Aucun utilisateur bloqué."
                : blockedModel.size() + " utilisateur(s) bloqué(s).";
        if (friendsList.getAccessibleContext() != null) {
            friendsList.getAccessibleContext().setAccessibleDescription(friendsDescription);
        }
        if (blockedList.getAccessibleContext() != null) {
            blockedList.getAccessibleContext().setAccessibleDescription(blockedDescription);
        }
    }

    private void updateStatus(String message) {
        statusLabel.setText(message == null || message.isBlank() ? " " : message);
    }

    private void focusList(JList<?> list) {
        if (list == null) {
            return;
        }
        SwingUtilities.invokeLater(() -> {
            list.requestFocusInWindow();
            if (!list.isSelectionEmpty()) {
                list.ensureIndexIsVisible(list.getSelectedIndex());
            }
        });
    }

    private void installEscapeBinding(JComponent component) {
        if (component == null) {
            return;
        }
        InputMap map = component.getInputMap(JComponent.WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
        map.put(KeyStroke.getKeyStroke("ESCAPE"), "social.relationships.focus-menu");
        ActionMap actions = component.getActionMap();
        actions.put("social.relationships.focus-menu", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (menuButtons != null && menuButtons.length > 0) {
                    JButton target = menuButtons[activeSection];
                    if (target.hasFocus()) {
                        if (onEscape != null) {
                            onEscape.run();
                        }
                    } else {
                        target.requestFocusInWindow();
                    }
                } else if (onEscape != null) {
                    onEscape.run();
                }
            }
        });
    }

    private static String sectionKey(int section) {
        return switch (section) {
            case SECTION_BLOCKED -> "blocked";
            default -> "friends";
        };
    }

    private static JLabel buildRelationshipCell(JList<?> list, Relationship relation, boolean isSelected) {
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
