package com.lemondelila.client.gamelogic.missionnemesis.view;

import javax.accessibility.AccessibleContext;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.border.Border;
import java.awt.Color;
import java.awt.Font;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Configuration accessible au clavier pour Mission Nemesis.
 * Navigation uniquement aux fleches, validation avec Entree/Espace.
 */
final class NemesisSetupPanel extends JPanel {

    interface Listener {
        void onStartRequested(Configuration configuration);
    }

    static final class Configuration {
        private final int boardSize;
        private final PlacementMode placementMode;

        Configuration(int boardSize, PlacementMode placementMode) {
            this.boardSize = boardSize;
            this.placementMode = placementMode;
        }

        int boardSize() {
            return boardSize;
        }

        PlacementMode placementMode() {
            return placementMode;
        }
    }

    enum PlacementMode {
        MANUAL("Manuel"),
        AUTO("Automatique");

        private final String label;

        PlacementMode(String label) {
            this.label = label;
        }

        String label() {
            return label;
        }
    }

    private static final Color SELECTED_BG = new Color(47, 68, 92);
    private static final Color SELECTED_BORDER_COLOR = new Color(102, 163, 255);
    private static final Border NORMAL_BORDER = BorderFactory.createEmptyBorder(8, 12, 8, 12);
    private static final Border SELECTED_BORDER = BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(SELECTED_BORDER_COLOR, 2),
            BorderFactory.createEmptyBorder(6, 10, 6, 10)
    );

    private final int[] boardSizes;
    private final Listener listener;
    private final List<Row> rows = new ArrayList<>();

    private int boardSizeIndex;
    private PlacementMode placementMode = PlacementMode.MANUAL;
    private int focusIndex;

    NemesisSetupPanel(int[] boardSizes, Listener listener) {
        this.boardSizes = Objects.requireNonNull(boardSizes, "boardSizes");
        this.listener = Objects.requireNonNull(listener, "listener");
        if (boardSizes.length == 0) {
            throw new IllegalArgumentException("Au moins une taille de grille est requise.");
        }

        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        setFocusable(true);
        setFocusTraversalKeysEnabled(false);
        getAccessibleContext().setAccessibleName("Configuration Mission Nemesis");

        add(buildTitle());
        add(Box.createVerticalStrut(16));

        Row sizeRow = addOptionRow("Taille de la grille", formatBoardSize(boardSizes[boardSizeIndex]));
        Row placementRow = addOptionRow("Placement initial", placementMode.label());
        Row startRow = addActionRow("Lancer la partie");

        rows.add(sizeRow);
        rows.add(placementRow);
        rows.add(startRow);

        updateFocusHighlight();

        addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                switch (e.getKeyCode()) {
                    case KeyEvent.VK_TAB, KeyEvent.VK_SHIFT -> e.consume();
                    case KeyEvent.VK_UP -> {
                        moveFocus(-1);
                        e.consume();
                    }
                    case KeyEvent.VK_DOWN -> {
                        moveFocus(1);
                        e.consume();
                    }
                    case KeyEvent.VK_LEFT -> {
                        adjustCurrentOption(-1);
                        e.consume();
                    }
                    case KeyEvent.VK_RIGHT -> {
                        adjustCurrentOption(1);
                        e.consume();
                    }
                    case KeyEvent.VK_ENTER, KeyEvent.VK_SPACE -> {
                        triggerCurrent();
                        e.consume();
                    }
                    default -> {
                        // ignore
                    }
                }
            }
        });
    }

    void activate() {
        resetNavigation();
        requestFocusInWindow();
        announce(rows.get(focusIndex).accessibleText());
    }

    Configuration currentConfiguration() {
        return new Configuration(boardSizes[boardSizeIndex], placementMode);
    }

    void resetNavigation() {
        focusIndex = 0;
        boardSizeIndex = Math.max(0, Math.min(boardSizeIndex, boardSizes.length - 1));
        placementMode = placementMode == null ? PlacementMode.MANUAL : placementMode;
        updateFocusHighlight();
    }

    private JPanel buildTitle() {
        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));

        JLabel title = new JLabel("Configurer Mission Nemesis");
        title.setFont(title.getFont().deriveFont(Font.BOLD, 20f));
        panel.add(title);

        JLabel instructions = new JLabel("Utilisez les fleches pour naviguer, Entree pour valider.");
        instructions.setFont(instructions.getFont().deriveFont(Font.PLAIN, 13f));
        panel.add(Box.createVerticalStrut(4));
        panel.add(instructions);

        return panel;
    }

    private Row addOptionRow(String label, String value) {
        Row row = new Row(label, value);
        add(row.panel);
        add(Box.createVerticalStrut(8));
        return row;
    }

    private Row addActionRow(String label) {
        Row row = new Row(label, "");
        row.value.setVisible(false);
        add(row.panel);
        add(Box.createVerticalStrut(8));
        return row;
    }

    private void moveFocus(int delta) {
        focusIndex = Math.floorMod(focusIndex + delta, rows.size());
        updateFocusHighlight();
    }

    private void adjustCurrentOption(int delta) {
        if (focusIndex == 0) {
            if (boardSizes.length == 1) {
                toolkitBeep();
                return;
            }
            int newIndex = Math.floorMod(boardSizeIndex + delta, boardSizes.length);
            if (newIndex != boardSizeIndex) {
                boardSizeIndex = newIndex;
                rows.get(0).value.setText(formatBoardSize(boardSizes[boardSizeIndex]));
                rows.get(0).updateAccessible();
                announce(rows.get(0).accessibleText());
            }
        } else if (focusIndex == 1) {
            placementMode = placementMode == PlacementMode.MANUAL ? PlacementMode.AUTO : PlacementMode.MANUAL;
            rows.get(1).value.setText(placementMode.label());
            rows.get(1).updateAccessible();
            announce(rows.get(1).accessibleText());
        } else {
            toolkitBeep();
        }
    }

    private void triggerCurrent() {
        if (focusIndex == 0 || focusIndex == 1) {
            adjustCurrentOption(1);
        } else if (focusIndex == 2) {
            announce("Lancement de la partie.");
            listener.onStartRequested(currentConfiguration());
        }
    }

    private void updateFocusHighlight() {
        for (int i = 0; i < rows.size(); i++) {
            rows.get(i).setSelected(i == focusIndex);
        }
        announce(rows.get(focusIndex).accessibleText());
    }

    private String formatBoardSize(int size) {
        return size + " x " + size;
    }

    private void toolkitBeep() {
        java.awt.Toolkit.getDefaultToolkit().beep();
    }

    private void announce(String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        AccessibleContext context = getAccessibleContext();
        if (context != null) {
            String oldDescription = context.getAccessibleDescription();
            String oldName = context.getAccessibleName();
            context.setAccessibleName(message);
            context.setAccessibleDescription(message);
            context.firePropertyChange(AccessibleContext.ACCESSIBLE_NAME_PROPERTY, oldName, message);
            context.firePropertyChange(AccessibleContext.ACCESSIBLE_DESCRIPTION_PROPERTY, oldDescription, message);
        }
    }

    private static final class Row {
        private final JPanel panel = new JPanel();
        private final JLabel label;
        private final JLabel value;

        private Row(String labelText, String valueText) {
            panel.setLayout(new BoxLayout(panel, BoxLayout.X_AXIS));
            panel.setBorder(NORMAL_BORDER);
            panel.setFocusable(false);

            label = new JLabel(labelText);
            label.setAlignmentX(LEFT_ALIGNMENT);
            label.setFont(label.getFont().deriveFont(Font.BOLD, 16f));
            panel.add(label);

            panel.add(Box.createHorizontalGlue());

            value = new JLabel(valueText);
            value.setAlignmentX(RIGHT_ALIGNMENT);
            value.setFont(value.getFont().deriveFont(Font.PLAIN, 16f));
            panel.add(value);

            updateAccessible();
        }

        private void setSelected(boolean selected) {
            if (selected) {
                panel.setBackground(SELECTED_BG);
                panel.setOpaque(true);
                panel.setBorder(SELECTED_BORDER);
                label.setForeground(Color.WHITE);
                value.setForeground(Color.WHITE);
            } else {
                panel.setOpaque(false);
                panel.setBorder(NORMAL_BORDER);
                label.setForeground(Color.BLACK);
                value.setForeground(Color.DARK_GRAY);
            }
            updateAccessible();
        }

        private String accessibleText() {
            if (value.isVisible() && !value.getText().isBlank()) {
                return label.getText() + " : " + value.getText();
            }
            return label.getText();
        }

        private void updateAccessible() {
            AccessibleContext context = panel.getAccessibleContext();
            if (context != null) {
                String text = accessibleText();
                context.setAccessibleName(text);
                context.setAccessibleDescription(text);
            }
        }
    }
}
