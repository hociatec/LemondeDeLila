package com.lemondelila.client.social.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.access.AccessibilityPreferences;

import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.ListSelectionModel;
import javax.swing.border.EmptyBorder;
import javax.swing.AbstractAction;
import javax.swing.KeyStroke;
import java.awt.Component;
import java.awt.Dimension;

public final class SocialView {

    private final JPanel root = new JPanel();
    private final JList<MenuEntry> menuList = new JList<>(MenuEntry.values());
    private Runnable messagingHandler;
    private Runnable friendsHandler;

    public SocialView() {
        root.setLayout(new BoxLayout(root, BoxLayout.Y_AXIS));
        root.setBorder(new EmptyBorder(48, 64, 48, 64));

        JLabel title = new JLabel(Internationalization.text("social.center.title"));
        title.setAlignmentX(Component.CENTER_ALIGNMENT);
        title.setFont(title.getFont().deriveFont(24f));
        root.add(title);

        root.add(Box.createRigidArea(new Dimension(0, 16)));

        JLabel description = new JLabel(Internationalization.text("social.center.description"));
        description.setAlignmentX(Component.CENTER_ALIGNMENT);
        root.add(description);

        root.add(Box.createRigidArea(new Dimension(0, 24)));

        menuList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        menuList.setVisibleRowCount(MenuEntry.values().length);
        menuList.setFixedCellHeight(44);
        menuList.setAlignmentX(Component.CENTER_ALIGNMENT);
        menuList.setFocusTraversalKeysEnabled(false);
        menuList.getAccessibleContext().setAccessibleName(Internationalization.text("social.menu.accessible"));
        AccessibilityPreferences.applyDescription(menuList.getAccessibleContext(), Internationalization.text("social.menu.accessible"));
        menuList.setCellRenderer((list, value, index, isSelected, cellHasFocus) -> {
            JLabel label = new JLabel(value == null ? "" : value.label());
            label.setOpaque(true);
            label.setBorder(new EmptyBorder(6, 8, 6, 8));
            if (isSelected) {
                label.setBackground(list.getSelectionBackground());
                label.setForeground(list.getSelectionForeground());
            } else {
                label.setBackground(list.getBackground());
                label.setForeground(list.getForeground());
            }
            label.getAccessibleContext().setAccessibleName(label.getText());
            AccessibilityPreferences.applyDescription(label.getAccessibleContext(), label.getText());
            return label;
        });
        menuList.getInputMap().put(KeyStroke.getKeyStroke("ENTER"), "social.menu.activate");
        menuList.getActionMap().put("social.menu.activate", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                activateSelection();
            }
        });
        menuList.addMouseListener(new java.awt.event.MouseAdapter() {
            @Override
            public void mouseClicked(java.awt.event.MouseEvent e) {
                if (e.getClickCount() == 2) {
                    activateSelection();
                }
            }
        });
        root.add(new JScrollPane(menuList));
        menuList.setSelectedIndex(0);
    }

    public JPanel component() {
        return root;
    }

    public void onOpenMessaging(Runnable handler) {
        this.messagingHandler = handler;
    }

    public void onOpenFriends(Runnable handler) {
        this.friendsHandler = handler;
    }

    public void focusMenu() {
        menuList.requestFocusInWindow();
    }

    private void activateSelection() {
        MenuEntry entry = menuList.getSelectedValue();
        if (entry == null) {
            return;
        }
        switch (entry) {
            case MESSAGING -> {
                if (messagingHandler != null) {
                    messagingHandler.run();
                }
            }
            case FRIENDS -> {
                if (friendsHandler != null) {
                    friendsHandler.run();
                }
            }
        }
    }

    private enum MenuEntry {
        MESSAGING("social.messaging.button"),
        FRIENDS("social.friends.button");

        private final String key;

        MenuEntry(String key) {
            this.key = key;
        }

        String label() {
            return Internationalization.text(key);
        }
    }
}
