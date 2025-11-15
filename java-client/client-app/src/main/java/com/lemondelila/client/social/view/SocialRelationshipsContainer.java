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

    private final SocialRelationshipsSectionType[] sectionTypes = SocialRelationshipsSectionType.values();
    private final SocialRelationshipsPanel[] panels = new SocialRelationshipsPanel[sectionTypes.length];
    private final CardLayout contentLayout = new CardLayout();
    private final JPanel contentPanel = new JPanel(contentLayout);
    private final JButton[] menuButtons = new JButton[sectionTypes.length];

    private Runnable onEscape;
    private SocialRelationshipsSectionType activeSection = sectionTypes[0];
    private Font menuBaseFont;
    private Font menuSelectedFont;

    SocialRelationshipsContainer(SocialRelationshipsController controller,
                                 Consumer<String> statusListener) {
        super(new BorderLayout(0, 12));
        Objects.requireNonNull(controller, "controller");
        Objects.requireNonNull(statusListener, "statusListener");

        for (int i = 0; i < sectionTypes.length; i++) {
            SocialRelationshipsSectionType type = sectionTypes[i];
            SocialRelationshipsPanel panel = new SocialRelationshipsPanel(controller, type, statusListener);
            panel.setOnEscape(this::focusMenu);
            panels[i] = panel;
            contentPanel.add(panel, type.name());
        }

        add(buildMenu(), BorderLayout.NORTH);
        add(contentPanel, BorderLayout.CENTER);
        installEscapeBinding(this);
        installEscapeBinding(contentPanel);
        showSection(0, false);
    }

    void reload() {
        for (SocialRelationshipsPanel panel : panels) {
            panel.reload();
        }
        showSection(activeSectionIndex(), false);
    }

    void focusContent() {
        panels[activeSectionIndex()].focusContent();
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

        for (int i = 0; i < sectionTypes.length; i++) {
            final int index = i;
            JButton button = new JButton(sectionTypes[i].title());
            if (menuBaseFont == null) {
                menuBaseFont = button.getFont();
                menuSelectedFont = menuBaseFont.deriveFont(Font.BOLD);
            }
            button.addActionListener(e -> showSection(index, true));
            configureMenuNavigation(button, index);
            menuButtons[i] = button;
            buttonsColumn.add(button);
            if (i < sectionTypes.length - 1) {
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
        activeSection = sectionTypes[clamped];
        contentLayout.show(contentPanel, activeSection.name());
        updateMenuButtons();
        if (focusContent) {
            panels[clamped].focusContent();
        }
    }

    private void updateMenuButtons() {
        int activeIndex = activeSectionIndex();
        for (int i = 0; i < menuButtons.length; i++) {
            JButton button = menuButtons[i];
            if (button == null || menuBaseFont == null || menuSelectedFont == null) {
                continue;
            }
            button.setFont(i == activeIndex ? menuSelectedFont : menuBaseFont);
        }
    }

    private void focusMenu() {
        int index = activeSectionIndex();
        JButton current = menuButtons[Math.max(0, Math.min(menuButtons.length - 1, index))];
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

    private int activeSectionIndex() {
        for (int i = 0; i < sectionTypes.length; i++) {
            if (sectionTypes[i] == activeSection) {
                return i;
            }
        }
        return 0;
    }
}
