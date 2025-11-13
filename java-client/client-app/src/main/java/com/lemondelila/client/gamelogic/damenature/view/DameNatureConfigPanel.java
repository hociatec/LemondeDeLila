package com.lemondelila.client.gamelogic.damenature.view;

import com.lemondelila.client.gamelogic.damenature.model.DameNatureConfig;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import javax.accessibility.AccessibleContext;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

final class DameNatureConfigPanel extends JPanel {

    interface Listener {
        void onLaunchRequested(DameNatureConfig config);
        void onCancelRequested();
        void onConfigChanged(DameNatureConfig config);
    }

    private final Listener listener;

    private final JLabel statusLabel = new JLabel(" ");
    private final JLabel botsValueLabel = new JLabel();
    private final JLabel dangerValueLabel = new JLabel();
    private final JLabel quizValueLabel = new JLabel();

    private final List<JComponent> focusOrder = new ArrayList<>();
    private int focusIndex;
    private DameNatureConfig currentConfig = DameNatureConfig.defaultConfig();

    DameNatureConfigPanel(Listener listener) {
        this.listener = Objects.requireNonNull(listener, "listener");
        buildUi();
        configureNavigation();
        updateLabels();
    }

    DameNatureConfig currentConfig() {
        return currentConfig;
    }

    void setConfig(DameNatureConfig config) {
        currentConfig = Objects.requireNonNull(config, "config");
        updateLabels();
    }

    void setStatusMessage(String message) {
        statusLabel.setText(message);
        setAccessibleDescription(statusLabel, message);
    }

    void focusFirst() {
        if (focusOrder.isEmpty()) {
            return;
        }
        focusIndex = 0;
        SwingUtilities.invokeLater(() -> focusOrder.get(0).requestFocusInWindow());
    }

    private void buildUi() {
        setOpaque(false);
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        setBorder(new EmptyBorder(16, 16, 16, 16));

        JLabel title = new JLabel("Préparer la partie Dame Nature");
        title.setFont(title.getFont().deriveFont(24f));
        title.setAlignmentX(LEFT_ALIGNMENT);
        add(title);
        add(Box.createRigidArea(new Dimension(0, 16)));

        JLabel instructions = new JLabel("Utilisez ↑/↓ pour naviguer, ←/→ pour ajuster, Entrée pour lancer.");
        instructions.setAlignmentX(LEFT_ALIGNMENT);
        add(instructions);
        add(Box.createRigidArea(new Dimension(0, 12)));

        add(optionRow("Nombre d’adversaires", botsValueLabel));
        add(Box.createRigidArea(new Dimension(0, 6)));
        add(optionRow("Cartes danger", dangerValueLabel));
        add(Box.createRigidArea(new Dimension(0, 6)));
        add(optionRow("Quiz nature", quizValueLabel));
        add(Box.createRigidArea(new Dimension(0, 12)));

        JLabel launchHint = new JLabel("Entrée : lancer la partie, Échap : annuler.");
        launchHint.setAlignmentX(LEFT_ALIGNMENT);
        add(launchHint);
        add(Box.createRigidArea(new Dimension(0, 16)));

        statusLabel.setAlignmentX(LEFT_ALIGNMENT);
        setAccessibleName(statusLabel, "Statut configuration");
        setAccessibleDescription(statusLabel, "");
        add(statusLabel);
    }

    private JPanel optionRow(String label, JLabel valueLabel) {
        JPanel row = new JPanel(new BorderLayout(8, 0));
        row.setOpaque(false);
        row.setBorder(new EmptyBorder(6, 8, 6, 8));

        JLabel jLabel = new JLabel(label);
        row.add(jLabel, BorderLayout.WEST);
        row.add(valueLabel, BorderLayout.CENTER);
        valueLabel.setHorizontalAlignment(JLabel.RIGHT);

        row.setFocusable(true);
        row.setFocusTraversalKeysEnabled(false);
        setAccessibleName(row, label + " : " + valueLabel.getText());
        row.addFocusListener(new FocusAdapter() {
            @Override
            public void focusGained(FocusEvent e) {
                row.setBorder(BorderFactory.createLineBorder(new java.awt.Color(70, 130, 180), 2));
                focusIndex = focusOrder.indexOf(row);
                announce(row.getAccessibleContext().getAccessibleName());
            }

            @Override
            public void focusLost(FocusEvent e) {
                row.setBorder(new EmptyBorder(6, 8, 6, 8));
            }
        });

        focusOrder.add(row);
        return row;
    }

    private void configureNavigation() {
        getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("UP"), "config-up");
        getActionMap().put("config-up", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                moveFocus(-1);
            }
        });

        getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("DOWN"), "config-down");
        getActionMap().put("config-down", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                moveFocus(1);
            }
        });

        getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("LEFT"), "config-left");
        getActionMap().put("config-left", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                adjustValue(-1);
            }
        });

        getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("RIGHT"), "config-right");
        getActionMap().put("config-right", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                adjustValue(1);
            }
        });

        getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("ENTER"), "config-launch");
        getActionMap().put("config-launch", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                listener.onLaunchRequested(currentConfig);
            }
        });

        getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("ESCAPE"), "config-cancel");
        getActionMap().put("config-cancel", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                listener.onCancelRequested();
            }
        });
    }

    private void moveFocus(int delta) {
        if (focusOrder.isEmpty()) {
            return;
        }
        focusIndex = Math.floorMod(focusIndex + delta, focusOrder.size());
        SwingUtilities.invokeLater(() -> focusOrder.get(focusIndex).requestFocusInWindow());
    }

    private void adjustValue(int delta) {
        if (focusIndex < 0 || focusIndex >= focusOrder.size()) {
            return;
        }
        DameNatureConfig updated = currentConfig;
        if (focusIndex == 0) {
            updated = currentConfig.withBotCount(currentConfig.botCount() + delta);
        } else if (focusIndex == 1) {
            updated = currentConfig.withIncludeDanger(delta > 0 || !currentConfig.includeDangerCards());
        } else if (focusIndex == 2) {
            updated = currentConfig.withIncludeQuiz(delta > 0 || !currentConfig.includeQuizCards());
        }
        if (updated != currentConfig) {
            currentConfig = updated;
            updateLabels();
            listener.onConfigChanged(currentConfig);
        }
    }

    private void updateLabels() {
        botsValueLabel.setText(currentConfig.botCount() + " bot(s)");
        dangerValueLabel.setText(currentConfig.includeDangerCards() ? "Activées" : "Désactivées");
        quizValueLabel.setText(currentConfig.includeQuizCards() ? "Activés" : "Désactivés");

        if (!focusOrder.isEmpty()) {
            JComponent botsRow = focusOrder.get(0);
            setAccessibleName(botsRow, "Nombre d’adversaires : " + botsValueLabel.getText());
            JComponent dangerRow = focusOrder.get(1);
            setAccessibleName(dangerRow, "Cartes danger : " + dangerValueLabel.getText());
            JComponent quizRow = focusOrder.get(2);
            setAccessibleName(quizRow, "Quiz nature : " + quizValueLabel.getText());
            if (botsRow.hasFocus() || dangerRow.hasFocus() || quizRow.hasFocus()) {
                announce(focusOrder.get(focusIndex).getAccessibleContext().getAccessibleName());
            }
        }
    }

    private void announce(String message) {
        getAccessibleContext().firePropertyChange(AccessibleContext.ACCESSIBLE_VALUE_PROPERTY, null, message);
    }

    private void setAccessibleName(JComponent component, String name) {
        AccessibleContext context = component.getAccessibleContext();
        if (context != null) {
            String safe = name == null ? "" : name;
            String old = context.getAccessibleName();
            if (!safe.equals(old)) {
                context.setAccessibleName(safe);
                context.firePropertyChange(AccessibleContext.ACCESSIBLE_NAME_PROPERTY, old, safe);
            }
        }
    }

    private void setAccessibleDescription(JComponent component, String description) {
        AccessibleContext context = component.getAccessibleContext();
        if (context != null) {
            String safe = description == null ? "" : description;
            String old = context.getAccessibleDescription();
            if (!safe.equals(old)) {
                context.setAccessibleDescription(safe);
                context.firePropertyChange(AccessibleContext.ACCESSIBLE_DESCRIPTION_PROPERTY, old, safe);
            }
        }
    }
}
