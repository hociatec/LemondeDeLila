package com.lemondelila.client.game.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.game.GameHistorySidebar;
import com.lemondelila.client.framework.access.game.GameHistoryTracker;

import javax.accessibility.AccessibleContext;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.util.Objects;

public abstract class AbstractGamePanel extends JPanel {

    private final JLabel statusLabel;
    private final JLabel pendingLabel;
    private final JTextArea selfArea;
    private final JTextArea playersArea;
    private final JTextArea scoreArea;
    private final GameHistorySidebar historySidebar;
    private final JPanel customContentPanel = new JPanel();
    private boolean accessibleToggle;

    protected AbstractGamePanel(GamePanelConfig config) {
        super(new BorderLayout(16, 16));
        Objects.requireNonNull(config, "config");
        setBorder(BorderFactory.createEmptyBorder(24, 32, 24, 32));
        setFocusable(true);
        setRequestFocusEnabled(true);
        setFocusTraversalKeysEnabled(false);
        statusLabel = buildLabel(config.statusAccessibleName(), config.statusAccessibleDesc());
        pendingLabel = buildLabel(config.pendingAccessibleName(), config.pendingAccessibleDesc());
        selfArea = createReadOnlyArea(config.selfBlockAccessibleName(), config.selfBlockAccessibleDesc());
        playersArea = createReadOnlyArea(config.playersBlockAccessibleName(), config.playersBlockAccessibleDesc());
        scoreArea = createReadOnlyArea(config.scoreBlockAccessibleName(), config.scoreBlockAccessibleDesc());
        historySidebar = new GameHistorySidebar(
                config.historyTitle(),
                config.historyAccessibleName(),
                config.historyAccessibleDesc(),
                new Dimension(320, 400)
        );
        customContentPanel.setOpaque(false);
        customContentPanel.setLayout(new BoxLayout(customContentPanel, BoxLayout.Y_AXIS));
        buildSkeleton(config);
    }

    private JLabel buildLabel(String name, String description) {
        JLabel label = new JLabel(" ");
        label.setAlignmentX(Component.LEFT_ALIGNMENT);
        label.setFocusable(false);
        AccessibleDecorator.apply(label, AccessibleSpec.builder()
                .name(name)
                .description(description)
                .build());
        return label;
    }

    private void buildSkeleton(GamePanelConfig config) {
        JPanel leftColumn = new JPanel();
        leftColumn.setOpaque(false);
        leftColumn.setLayout(new BoxLayout(leftColumn, BoxLayout.Y_AXIS));

        leftColumn.add(statusLabel);
        leftColumn.add(Box.createRigidArea(new Dimension(0, 8)));
        leftColumn.add(pendingLabel);
        leftColumn.add(Box.createRigidArea(new Dimension(0, 12)));
        leftColumn.add(customContentPanel);
        leftColumn.add(Box.createRigidArea(new Dimension(0, 12)));
        leftColumn.add(wrap(selfArea, config.selfBlockTitle()));
        leftColumn.add(Box.createRigidArea(new Dimension(0, 12)));
        leftColumn.add(wrap(playersArea, config.playersBlockTitle()));
        leftColumn.add(Box.createRigidArea(new Dimension(0, 12)));
        leftColumn.add(wrap(scoreArea, config.scoreBlockTitle()));
        add(leftColumn, BorderLayout.CENTER);
        add(historySidebar, BorderLayout.EAST);
    }

    protected JPanel customContentPanel() {
        return customContentPanel;
    }

    protected JTextArea selfArea() {
        return selfArea;
    }

    protected JTextArea playersArea() {
        return playersArea;
    }

    protected JTextArea scoreArea() {
        return scoreArea;
    }

    protected JTextArea createReadOnlyArea(String accessibleName, String accessibleDescription) {
        JTextArea area = new JTextArea();
        area.setEditable(false);
        area.setLineWrap(true);
        area.setWrapStyleWord(true);
        area.setFocusable(false);
        AccessibleDecorator.apply(area, AccessibleSpec.builder()
                .name(accessibleName)
                .description(accessibleDescription)
                .build());
        return area;
    }

    protected JScrollPane wrap(JTextArea area, String title) {
        JScrollPane scroll = new JScrollPane(area);
        if (title != null && !title.isBlank()) {
            scroll.setBorder(BorderFactory.createTitledBorder(title));
        } else {
            scroll.setBorder(BorderFactory.createEmptyBorder());
        }
        scroll.setAlignmentX(Component.LEFT_ALIGNMENT);
        scroll.setPreferredSize(new Dimension(320, 140));
        return scroll;
    }

    public void updateStatus(String text, String accessibleDescription) {
        statusLabel.setText(text == null ? " " : text);
        if (accessibleDescription != null) {
            statusLabel.getAccessibleContext().setAccessibleDescription(accessibleDescription);
        }
    }

    public void updatePending(String text) {
        pendingLabel.setText(text == null ? " " : text);
        pendingLabel.getAccessibleContext().setAccessibleDescription(pendingLabel.getText());
    }

    public void updateYourProgress(String text) {
        updateArea(selfArea, text);
    }

    public void updatePlayers(String text) {
        updateArea(playersArea, text);
    }

    public void updateScore(String text) {
        updateArea(scoreArea, text);
    }

    private void updateArea(JTextArea area, String text) {
        area.setText(text == null ? "" : text);
        area.getAccessibleContext().setAccessibleDescription(area.getText());
    }

    public void updateHistory(GameHistoryTracker tracker, String emptyMessage) {
        historySidebar.render(tracker, emptyMessage);
    }

    public void focusHistory() {
        historySidebar.focusHistory();
    }

    public void focusMain() {
        requestFocusInWindow();
    }

    public void announceScore(String message) {
        fireAccessibleText(scoreArea, message);
    }

    public void announceBasket(String message) {
        fireAccessibleText(selfArea, message);
    }

    private void fireAccessibleText(JComponent component, String message) {
        if (component == null || message == null || message.isBlank()) {
            return;
        }
        AccessibleContext context = component.getAccessibleContext();
        if (context == null) {
            return;
        }
        String payload = accessibleToggle ? message + "\u200B" : message;
        accessibleToggle = !accessibleToggle;
        Runnable fire = () -> {
            context.setAccessibleDescription("");
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_TEXT_PROPERTY,
                    null,
                    "");
            context.setAccessibleDescription(payload);
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_TEXT_PROPERTY,
                    null,
                    payload);
        };
        if (SwingUtilities.isEventDispatchThread()) {
            fire.run();
        } else {
            SwingUtilities.invokeLater(fire);
        }
    }

    public record GamePanelConfig(
            String statusAccessibleName,
            String statusAccessibleDesc,
            String pendingAccessibleName,
            String pendingAccessibleDesc,
            String historyTitle,
            String historyAccessibleName,
            String historyAccessibleDesc,
            String selfBlockTitle,
            String selfBlockAccessibleName,
            String selfBlockAccessibleDesc,
            String playersBlockTitle,
            String playersBlockAccessibleName,
            String playersBlockAccessibleDesc,
            String scoreBlockTitle,
            String scoreBlockAccessibleName,
            String scoreBlockAccessibleDesc) {
    }
}
