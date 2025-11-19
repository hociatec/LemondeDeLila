package com.lemondelila.client.catalogue.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.media.SoundBank;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.DefaultListModel;
import javax.swing.JComponent;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.KeyStroke;
import javax.swing.ListCellRenderer;
import javax.swing.ListSelectionModel;
import java.awt.BorderLayout;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

/**
 * Facteur commun pour les listes du catalogue (catégories & jeux) :
 * gestion du son, du focus et des raccourcis.
 */
abstract class AbstractCatalogListPanel<T> extends JPanel {

    private final DefaultListModel<T> model = new DefaultListModel<>();
    private final JList<T> list = new JList<>(model);
    private final SoundEffectManager soundManager;
    private final List<Consumer<T>> selectionListeners = new ArrayList<>();

    AbstractCatalogListPanel(String borderTitle,
                             AccessibleSpec accessibleSpec,
                             SoundEffectManager soundManager) {
        this.soundManager = soundManager;
        setLayout(new BorderLayout());
        setOpaque(false);
        list.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        list.setVisibleRowCount(-1);
        list.setFocusTraversalKeysEnabled(false);
        list.setCellRenderer(createRenderer());
        AccessibleDecorator.apply(list, accessibleSpec);
        list.addListSelectionListener(event -> {
            if (event.getValueIsAdjusting()) {
                return;
            }
            if (list.isFocusOwner() && this.soundManager != null) {
                this.soundManager.play(SoundBank.MENU_NAVIGATE);
            }
            T selection = list.getSelectedValue();
            for (Consumer<T> listener : selectionListeners) {
                listener.accept(selection);
            }
        });
        JScrollPane scroll = new JScrollPane(list);
        if (borderTitle != null && !borderTitle.isBlank()) {
            scroll.setBorder(BorderFactory.createTitledBorder(borderTitle));
        } else {
            scroll.setBorder(BorderFactory.createEmptyBorder());
        }
        add(scroll, BorderLayout.CENTER);
    }

    protected abstract ListCellRenderer<T> createRenderer();

    void show(List<T> items, int selectedIndex) {
        model.clear();
        for (T item : items) {
            model.addElement(item);
        }
        if (!items.isEmpty()) {
            int index = Math.max(0, Math.min(selectedIndex, items.size() - 1));
            list.setSelectedIndex(index);
            list.ensureIndexIsVisible(index);
        } else {
            list.clearSelection();
        }
    }

    void onEnter(Runnable action) {
        Objects.requireNonNull(action, "action");
        list.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "catalog.select");
        list.getActionMap().put("catalog.select", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (soundManager != null) {
                    soundManager.play(SoundBank.MENU_SELECT);
                }
                action.run();
            }
        });
    }

    void onSelectionChange(Consumer<T> listener) {
        Objects.requireNonNull(listener, "listener");
        selectionListeners.add(listener);
    }

    void onEscape(Runnable action) {
        Objects.requireNonNull(action, "action");
        list.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ESCAPE"), "catalog.escape");
        list.getActionMap().put("catalog.escape", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                action.run();
            }
        });
    }

    T selectedItem() {
        return list.getSelectedValue();
    }

    int selectedIndex() {
        return list.getSelectedIndex();
    }

    @Override
    public void setEnabled(boolean enabled) {
        super.setEnabled(enabled);
        list.setEnabled(enabled);
    }

    @Override
    public boolean requestFocusInWindow() {
        return list.requestFocusInWindow();
    }
}
