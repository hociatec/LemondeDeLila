package com.lemondelila.client.game.room.browser.view;

import com.lemondelila.client.framework.ui.util.ButtonUtils;

import javax.swing.AbstractAction;
import javax.swing.DefaultListModel;
import javax.swing.JButton;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.KeyStroke;
import javax.swing.ListSelectionModel;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.FlowLayout;
import java.awt.event.ActionEvent;
import java.util.List;
import java.util.function.Consumer;

public final class RoomBrowserView {

    private final JPanel root = new JPanel(new BorderLayout(8, 8));
    private final DefaultListModel<Object> model = new DefaultListModel<>();
    private final JList<Object> list = new JList<>(model);
    private final JLabel status = new JLabel(" ");
    private final JButton refresh = new JButton("Rafraichir");
    private final JButton join = new JButton("Rejoindre");

    private Consumer<Integer> onJoin;
    private Runnable onRefresh;

    public RoomBrowserView() {
        root.setBorder(new EmptyBorder(16, 16, 16, 16));
        JPanel header = new JPanel(new BorderLayout(0, 6));
        JLabel title = new JLabel("Tables publiques");
        title.setFont(title.getFont().deriveFont(18f));
        header.add(title, BorderLayout.NORTH);

        JPanel statusPanel = new JPanel(new FlowLayout(FlowLayout.LEFT));
        statusPanel.add(status);
        header.add(statusPanel, BorderLayout.CENTER);
        root.add(header, BorderLayout.NORTH);

        list.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        JScrollPane scroll = new JScrollPane(list);
        root.add(scroll, BorderLayout.CENTER);

        JPanel actions = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        ButtonUtils.enterActivates(refresh);
        ButtonUtils.enterActivates(join);
        actions.add(refresh);
        actions.add(join);
        root.add(actions, BorderLayout.SOUTH);

        refresh.addActionListener(e -> {
            if (onRefresh != null) onRefresh.run();
        });
        join.addActionListener(e -> joinSelected());

        list.addListSelectionListener(e -> updateJoinEnabled());
        updateJoinEnabled();

        // Entrée rejoint la table sélectionnée.
        list.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "join-selected");
        list.getActionMap().put("join-selected", new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                joinSelected();
            }
        });

        setStatus(" ");
    }

    public JPanel component() {
        return root;
    }

    public void setRooms(List<?> rooms) {
        model.clear();
        List<?> safe = rooms == null ? List.of() : rooms;
        if (safe.isEmpty()) {
            model.addElement("Aucune table publique en cours.");
        } else {
            safe.forEach(model::addElement);
        }
        if (model.size() > 0) {
            list.setSelectedIndex(0);
        }
        updateJoinEnabled();
    }

    public void setStatus(String text) {
        status.setText(text == null ? " " : text);
    }

    public void onJoin(Consumer<Integer> handler) {
        this.onJoin = handler;
    }

    public void onRefresh(Runnable handler) {
        this.onRefresh = handler;
    }

    private Integer extractRoomId(Object value) {
        if (value == null) return null;
        String text = value.toString();
        if (!text.startsWith("#")) return null;
        int space = text.indexOf(' ');
        if (space <= 1) return null;
        try {
            return Integer.parseInt(text.substring(1, space));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private void updateJoinEnabled() {
        join.setEnabled(extractRoomId(list.getSelectedValue()) != null);
    }

    private void joinSelected() {
        if (onJoin == null) {
            return;
        }
        int index = list.getSelectedIndex();
        if (index < 0) {
            return;
        }
        Object value = model.get(index);
        Integer roomId = extractRoomId(value);
        if (roomId != null) {
            onJoin.accept(roomId);
            return;
        }
        // Si on est sur un header (ex: "=== ... ==="), on tente la prochaine entrée rejoignable.
        for (int i = index + 1; i < model.size(); i++) {
            Integer next = extractRoomId(model.get(i));
            if (next != null) {
                list.setSelectedIndex(i);
                onJoin.accept(next);
                return;
            }
        }
    }
}
