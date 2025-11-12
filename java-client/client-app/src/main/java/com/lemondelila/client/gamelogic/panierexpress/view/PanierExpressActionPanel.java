package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.framework.access.AccessibleDecorator;
import com.lemondelila.framework.access.AccessibleSpec;

import javax.swing.AbstractAction;
import javax.swing.DefaultListCellRenderer;
import javax.swing.DefaultListModel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.KeyStroke;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.event.ActionEvent;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

/**
 * Liste des actions disponibles pour Panier Express.
 */
final class PanierExpressActionPanel extends JPanel {

    record ActionItem(String id, String label, String description, Runnable action) {
        ActionItem {
            Objects.requireNonNull(label, "label");
            Objects.requireNonNull(action, "action");
        }
    }

    private final DefaultListModel<ActionItem> model = new DefaultListModel<>();
    private final JList<ActionItem> list = new JList<>(model);
    private Consumer<ActionItem> onSelectionChange;

    PanierExpressActionPanel() {
        super(new BorderLayout());
        buildUi();
    }

    private void buildUi() {
        list.setVisibleRowCount(5);
        list.setSelectionMode(javax.swing.ListSelectionModel.SINGLE_SELECTION);
        list.setFocusable(true);
        list.setCellRenderer(new DefaultListCellRenderer() {
            @Override
            public Component getListCellRendererComponent(JList<?> list,
                                                          Object value,
                                                          int index,
                                                          boolean isSelected,
                                                          boolean cellHasFocus) {
                Component component = super.getListCellRendererComponent(list, value, index, isSelected, cellHasFocus);
                if (value instanceof ActionItem item) {
                    setText(item.label());
                    setToolTipText(item.description());
                }
                return component;
            }
        });
        list.addListSelectionListener(event -> {
            if (!event.getValueIsAdjusting()) {
                ActionItem item = list.getSelectedValue();
                if (item != null && onSelectionChange != null) {
                    onSelectionChange.accept(item);
                }
            }
        });
        AccessibleDecorator.apply(list, AccessibleSpec.builder()
                .name("Actions disponibles")
                .description("Utilisez les flèches haut et bas pour parcourir les actions, Entrée pour exécuter l'action sélectionnée.")
                .build());

        list.getInputMap(WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "execute");
        list.getActionMap().put("execute", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                executeSelectedAction();
            }
        });

        JScrollPane scroll = new JScrollPane(list);
        scroll.setBorder(javax.swing.BorderFactory.createTitledBorder("Actions"));
        add(scroll, BorderLayout.CENTER);
    }

    void setActions(List<ActionItem> actions) {
        model.clear();
        if (actions != null) {
            actions.stream()
                    .filter(Objects::nonNull)
                    .forEach(model::addElement);
        }
        if (!model.isEmpty()) {
            list.setSelectedIndex(0);
        }
    }

    boolean executeSelectedAction() {
        ActionItem item = list.getSelectedValue();
        if (item == null) {
            return false;
        }
        item.action().run();
        return true;
    }

    void focusList() {
        list.requestFocusInWindow();
    }

    void setOnSelectionChange(Consumer<ActionItem> listener) {
        this.onSelectionChange = listener;
    }

    boolean isEmpty() {
        return model.isEmpty();
    }

    ActionItem selectedItem() {
        return list.getSelectedValue();
    }
}

