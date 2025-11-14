package com.lemondelila.client.social.view;

import com.lemondelila.client.social.controller.SocialRelationshipsController;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.InputMap;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.util.Objects;
import java.util.function.Consumer;

final class SocialRelationshipsContainer extends JPanel {

    private final SocialRelationshipsPanel friendsPanel;
    private final SocialRelationshipsPanel blockedPanel;
    private final CardLayout contentLayout = new CardLayout();
    private final JPanel contentPanel = new JPanel(contentLayout);
    private final JButton[] menuButtons = new JButton[2];

    private Runnable onEscape;
    private int activeSection = 0;
    private Font menuBaseFont;
    private Font menuSelectedFont;

    SocialRelationshipsContainer(SocialRelationshipsController controller,
                                 Consumer<String> statusListener) {
        super(new BorderLayout(0, 12));
        Objects.requireNonNull(controller, "controller");
        Objects.requireNonNull(statusListener, "statusListener");

        this.friendsPanel = new SocialRelationshipsPanel(controller, SocialRelationshipsSectionType.FRIENDS, statusListener);
        this.blockedPanel = new SocialRelationshipsPanel(controller, SocialRelationshipsSectionType.BLOCKED, statusListener);
        this.friendsPanel.setOnEscape(this::focusMenu);
        this.blockedPanel.setOnEscape(this::focusMenu);

        add(buildMenu(), BorderLayout.NORTH);
        contentPanel.add(friendsPanel, SocialRelationshipsSectionType.FRIENDS.name());
        contentPanel.add(blockedPanel, SocialRelationshipsSectionType.BLOCKED.name());
        add(contentPanel, BorderLayout.CENTER);
        installEscapeBinding(this);
        installEscapeBinding(contentPanel);
        showSection(activeSection, false);
    }

    void reload() {
        friendsPanel.reload();
        blockedPanel.reload();
        showSection(activeSection, false);
    }

    void focusContent() {
        if (activeSection == 0) {
            friendsPanel.focusContent();
        } else {
            blockedPanel.focusContent();
        }
    }

    void setOnEscape(Runnable onEscape) {
        this.onEscape = onEscape;
    }

    private JPanel buildMenu() {
        JPanel wrapper = new JPanel();
        wrapper.setLayout(new BoxLayout(wrapper, BoxLayout.Y_AXIS));

        JLabel title = new JLabel("Relations");
        title.setFont(title.getFont().deriveFont(Font.BOLD, 16f));
        wrapper.add(title);
        wrapper.add(Box.createVerticalStrut(6));

        JPanel buttonsColumn = new JPanel();
        buttonsColumn.setLayout(new BoxLayout(buttonsColumn, BoxLayout.Y_AXIS));

        String[] labels = {"Liste d'amis", "Amis bloqués"};
        for (int i = 0; i < labels.length; i++) {
            final int index = i;
            JButton button = new JButton(labels[i]);
            if (menuBaseFont == null) {
                menuBaseFont = button.getFont();
                menuSelectedFont = menuBaseFont.deriveFont(Font.BOLD);
            }
            button.addActionListener(e -> showSection(index, true));
            configureMenuNavigation(button, index);
            menuButtons[i] = button;
            buttonsColumn.add(button);
            if (i < labels.length - 1) {
                buttonsColumn.add(Box.createVerticalStrut(6));
            }
        }
        wrapper.add(buttonsColumn);
        wrapper.add(Box.createVerticalStrut(8));

        JPanel footerHint = new JPanel(new FlowLayout(FlowLayout.LEFT, 4, 0));
        footerHint.add(new JLabel("Utilisez Entrée pour ouvrir la section."));
        wrapper.add(footerHint);
        updateMenuButtons();
        return wrapper;
    }

    private void configureMenuNavigation(JButton button, int index) {
        InputMap map = button.getInputMap(JComponent.WHEN_FOCUSED);
        ActionMap actions = button.getActionMap();

        map.put(KeyStroke.getKeyStroke("UP"), "relationships.menu.up");
        map.put(KeyStroke.getKeyStroke("DOWN"), "relationships.menu.down");
        map.put(KeyStroke.getKeyStroke("ENTER"), "relationships.menu.select");

        actions.put("relationships.menu.up", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                focusMenuButton((index + menuButtons.length - 1) % menuButtons.length);
            }
        });
        actions.put("relationships.menu.down", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                focusMenuButton((index + 1) % menuButtons.length);
            }
        });
        actions.put("relationships.menu.select", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                showSection(index, true);
            }
        });
    }

    private void focusMenuButton(int index) {
        if (menuButtons[index] != null) {
            menuButtons[index].requestFocusInWindow();
        }
    }

    private void showSection(int section, boolean focusContent) {
        int clamped = Math.max(0, Math.min(menuButtons.length - 1, section));
        activeSection = clamped;
        if (clamped == 0) {
            contentLayout.show(contentPanel, SocialRelationshipsSectionType.FRIENDS.name());
        } else {
            contentLayout.show(contentPanel, SocialRelationshipsSectionType.BLOCKED.name());
        }
        updateMenuButtons();
        if (focusContent) {
            focusContent();
        }
    }

    private void updateMenuButtons() {
        for (int i = 0; i < menuButtons.length; i++) {
            JButton button = menuButtons[i];
            if (button == null || menuBaseFont == null || menuSelectedFont == null) {
                continue;
            }
            button.setFont(i == activeSection ? menuSelectedFont : menuBaseFont);
        }
    }

    private void focusMenu() {
        JButton current = menuButtons[Math.max(0, Math.min(menuButtons.length - 1, activeSection))];
        if (current == null) {
            return;
        }
        if (current.hasFocus()) {
            if (onEscape != null) {
                onEscape.run();
            }
        } else {
            current.requestFocusInWindow();
        }
    }

    private void installEscapeBinding(JComponent component) {
        InputMap map = component.getInputMap(JComponent.WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
        map.put(KeyStroke.getKeyStroke("ESCAPE"), "relationships.container.escape");
        ActionMap actions = component.getActionMap();
        actions.put("relationships.container.escape", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                focusMenu();
            }
        });
    }
}
