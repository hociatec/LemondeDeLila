package com.lemondelila.client.game.view;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;

/**
 * Affiche une liste de cibles pour une action d'échange (ou équivalent) et propose
 * une zone de description accessible. Les textes sont fournis par le jeu afin que
 * ce composant puisse être réutilisé tel quel.
 */
public final class GameExchangePanel extends JPanel {

    private final JLabel titleLabel = new JLabel(" ");
    private final JTextArea descriptionArea = new JTextArea();
    private final JList<TargetOption> targetList = new JList<>();
    private final JScrollPane listScroll;
    private final String defaultPanelTitle;
    private final String descriptionAccessibleName;
    private final String targetsAccessibleName;

    private Function<Integer, CompletableFuture<?>> callback;

    public GameExchangePanel(String panelTitle,
                             String descriptionAccessibleName,
                             String targetsAccessibleName,
                             Dimension preferredListSize) {
        this.defaultPanelTitle = Objects.requireNonNull(panelTitle, "panelTitle");
        this.descriptionAccessibleName = Objects.requireNonNull(descriptionAccessibleName, "descriptionAccessibleName");
        this.targetsAccessibleName = Objects.requireNonNull(targetsAccessibleName, "targetsAccessibleName");
        setOpaque(false);
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        setBorder(BorderFactory.createTitledBorder(panelTitle));

        descriptionArea.setLineWrap(true);
        descriptionArea.setWrapStyleWord(true);
        descriptionArea.setEditable(false);
        descriptionArea.setFocusable(false);
        descriptionArea.setBackground(getBackground());
        descriptionArea.getAccessibleContext().setAccessibleName(descriptionAccessibleName);

        targetList.setVisibleRowCount(4);
        targetList.getAccessibleContext().setAccessibleName(targetsAccessibleName);
        targetList.addListSelectionListener(e -> {
            if (!e.getValueIsAdjusting()) {
                SwingUtilities.invokeLater(() -> targetList.requestFocusInWindow());
            }
        });
        targetList.getInputMap().put(KeyStroke.getKeyStroke("ENTER"), "submit-exchange");
        targetList.getActionMap().put("submit-exchange", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                submitSelection();
            }
        });

        listScroll = new JScrollPane(targetList);
        listScroll.setAlignmentX(LEFT_ALIGNMENT);
        listScroll.setPreferredSize(preferredListSize == null ? new Dimension(320, 96) : preferredListSize);

        add(titleLabel);
        add(Box.createRigidArea(new Dimension(0, 4)));
        add(descriptionArea);
        add(Box.createRigidArea(new Dimension(0, 4)));
        add(listScroll);

        hidePanel();
    }

    public GameExchangePanel(String panelTitle,
                             String descriptionAccessibleName,
                             String targetsAccessibleName) {
        this(panelTitle, descriptionAccessibleName, targetsAccessibleName, new Dimension(320, 96));
    }

    public void showPrompt(String title,
                           String effect,
                           List<TargetOption> targets,
                           Function<Integer, CompletableFuture<?>> onConfirm,
                           String guidance) {
        callback = onConfirm;
        String effectiveTitle = title == null || title.isBlank() ? defaultPanelTitle : title;
        titleLabel.setText(effectiveTitle);

        StringBuilder builder = new StringBuilder();
        if (effect != null && !effect.isBlank()) {
            builder.append(effect);
        }
        if (guidance != null && !guidance.isBlank()) {
            if (builder.length() > 0) {
                builder.append('\n');
            }
            builder.append(guidance);
        }
        String description = builder.toString();
        descriptionArea.setText(description);
        descriptionArea.getAccessibleContext().setAccessibleDescription(
                description.isBlank() ? descriptionAccessibleName : description);

        targetList.clearSelection();
        if (targets == null || targets.isEmpty()) {
            targetList.setListData(new TargetOption[0]);
            targetList.setEnabled(false);
        } else {
            targetList.setListData(targets.toArray(TargetOption[]::new));
            targetList.setEnabled(true);
            targetList.setSelectedIndex(0);
            SwingUtilities.invokeLater(targetList::requestFocusInWindow);
        }
        setVisible(true);
    }

    public void showWaiting(String title, String effect, String waitingMessage) {
        callback = null;
        String effectiveTitle = title == null || title.isBlank() ? defaultPanelTitle : title;
        titleLabel.setText(effectiveTitle);

        StringBuilder builder = new StringBuilder();
        if (waitingMessage != null && !waitingMessage.isBlank()) {
            builder.append(waitingMessage);
        }
        if (effect != null && !effect.isBlank()) {
            if (builder.length() > 0) {
                builder.append('\n');
            }
            builder.append(effect);
        }
        String description = builder.toString();
        descriptionArea.setText(description);
        descriptionArea.getAccessibleContext().setAccessibleDescription(
                description.isBlank() ? descriptionAccessibleName : description);

        targetList.setListData(new TargetOption[0]);
        targetList.clearSelection();
        targetList.setEnabled(false);
        setVisible(true);
    }

    public void hidePanel() {
        setVisible(false);
        callback = null;
        targetList.setListData(new TargetOption[0]);
        targetList.clearSelection();
        targetList.setEnabled(false);
        descriptionArea.setText("");
        descriptionArea.getAccessibleContext().setAccessibleDescription(descriptionAccessibleName);
        titleLabel.setText(defaultPanelTitle);
    }

    private void submitSelection() {
        if (callback == null) {
            return;
        }
        TargetOption option = targetList.getSelectedValue();
        if (option == null) {
            return;
        }
        CompletableFuture<?> future = callback.apply(option.id());
        if (future == null) {
            return;
        }
        targetList.setEnabled(false);
        future.whenComplete((ignored, error) ->
                SwingUtilities.invokeLater(() -> targetList.setEnabled(true)));
    }

    public record TargetOption(int id, String label) {
        @Override
        public String toString() {
            return label;
        }
    }
}
