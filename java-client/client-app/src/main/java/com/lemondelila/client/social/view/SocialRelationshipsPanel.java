package com.lemondelila.client.social.view;

import com.lemondelila.client.messaging.service.UserRelationshipService.Relationship;
import com.lemondelila.client.social.controller.SocialRelationshipsController;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.BorderFactory;
import javax.swing.DefaultListModel;
import javax.swing.InputMap;
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
import java.awt.FlowLayout;
import java.awt.event.ActionEvent;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public final class SocialRelationshipsPanel extends JPanel {

    private final SocialRelationshipsController controller;
    private final SocialRelationshipsSectionType sectionType;
    private final Consumer<String> statusListener;

    private final DefaultListModel<Relationship> listModel = new DefaultListModel<>();
    private final JList<Relationship> list = new JList<>(listModel);
    private final JLabel summaryLabel = new JLabel(" ");
    private final JButton actionButton = new JButton();
    private Runnable onEscape;

    public SocialRelationshipsPanel(SocialRelationshipsController controller,
                                    SocialRelationshipsSectionType sectionType,
                                    Consumer<String> statusListener) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.sectionType = Objects.requireNonNull(sectionType, "sectionType");
        this.statusListener = Objects.requireNonNull(statusListener, "statusListener");
        buildUi();
        configureList();
    }

    public void reload() {
        List<Relationship> relationships = switch (sectionType) {
            case FRIENDS -> controller.loadFriends();
            case BLOCKED -> controller.loadBlocked();
        };
        listModel.clear();
        relationships.forEach(listModel::addElement);
        list.clearSelection();
        updateSummary(relationships.size());
        updateAccessibility(relationships.size());
        updateActionState();
    }

    public void focusContent() {
        SwingUtilities.invokeLater(() -> {
            if (listModel.getSize() > 0 && list.isSelectionEmpty()) {
                list.setSelectedIndex(0);
            }
            list.requestFocusInWindow();
            if (!list.isSelectionEmpty()) {
                list.ensureIndexIsVisible(list.getSelectedIndex());
            }
        });
    }

    public void setOnEscape(Runnable onEscape) {
        this.onEscape = onEscape;
    }

    private void buildUi() {
        setLayout(new BorderLayout(8, 8));
        setBorder(new EmptyBorder(12, 12, 12, 12));

        JPanel listContainer = new JPanel(new BorderLayout());
        listContainer.setBorder(BorderFactory.createTitledBorder(sectionType.title()));
        JScrollPane scroll = new JScrollPane(list);
        listContainer.add(scroll, BorderLayout.CENTER);
        add(listContainer, BorderLayout.CENTER);
        add(buildFooter(), BorderLayout.SOUTH);

        installEscapeBinding(this);
        installEscapeBinding(listContainer);
        installEscapeBinding(list);
    }

    private JPanel buildFooter() {
        JPanel panel = new JPanel(new BorderLayout(8, 4));
        summaryLabel.setBorder(new EmptyBorder(0, 6, 0, 6));
        panel.add(summaryLabel, BorderLayout.CENTER);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        actionButton.setText(sectionType.actionLabel());
        actionButton.addActionListener(e -> handlePrimaryAction());
        actionButton.setEnabled(false);
        actions.add(actionButton);
        panel.add(actions, BorderLayout.EAST);
        return panel;
    }

    private void configureList() {
        list.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        list.setFixedCellHeight(28);
        list.setVisibleRowCount(-1);
        list.setCellRenderer((lst, value, index, isSelected, cellHasFocus) ->
                buildRelationshipCell(lst, value, isSelected));
        list.addListSelectionListener(createSelectionListener());
        if (list.getAccessibleContext() != null) {
            list.getAccessibleContext().setAccessibleName(sectionType.title());
        }
    }

    private ListSelectionListener createSelectionListener() {
        return event -> {
            if (!event.getValueIsAdjusting()) {
                updateActionState();
            }
        };
    }

    private void handlePrimaryAction() {
        Relationship relation = list.getSelectedValue();
        if (relation == null) {
            statusListener.accept(sectionType.selectionPrompt());
            return;
        }
        String feedback = sectionType.performAction(controller, relation);
        statusListener.accept(feedback);
        reload();
        focusContent();
    }

    private void updateSummary(int count) {
        summaryLabel.setText(sectionType.summaryForCount(count));
    }

    private void updateAccessibility(int count) {
        if (list.getAccessibleContext() == null) {
            return;
        }
        list.getAccessibleContext().setAccessibleDescription(sectionType.summaryForCount(count));
    }

    private void updateActionState() {
        actionButton.setEnabled(list.getSelectedValue() != null);
    }

    private void installEscapeBinding(JComponent component) {
        InputMap map = component.getInputMap(JComponent.WHEN_ANCESTOR_OF_FOCUSED_COMPONENT);
        map.put(KeyStroke.getKeyStroke("ESCAPE"), "social.relationships.escape");
        ActionMap actions = component.getActionMap();
        actions.put("social.relationships.escape", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (onEscape != null) {
                    onEscape.run();
                }
            }
        });
    }

    private static JLabel buildRelationshipCell(JList<?> list,
                                                Relationship relation,
                                                boolean isSelected) {
        JLabel label = new JLabel();
        if (relation != null) {
            String username = relation.username();
            if (username != null && !username.isBlank()) {
                label.setText(username + " (#" + relation.id() + ")");
            } else {
                label.setText("Utilisateur #" + relation.id());
            }
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
