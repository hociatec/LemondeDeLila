package com.lemondelila.client.game.history.view;

import javax.swing.JPanel;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.util.Objects;

public final class GameHistorySidebar extends JPanel {

    private final GameHistoryView historyView;

    public GameHistorySidebar(String title,
                              String accessibleTitle,
                              String accessibleDescription) {
        this(title, accessibleTitle, accessibleDescription, null);
    }

    public GameHistorySidebar(String title,
                              String accessibleTitle,
                              String accessibleDescription,
                              Dimension preferredSize) {
        super(new BorderLayout());
        this.historyView = new GameHistoryView(
                Objects.requireNonNull(title, "title"),
                Objects.requireNonNull(accessibleTitle, "accessibleTitle"),
                Objects.requireNonNull(accessibleDescription, "accessibleDescription")
        );
        setOpaque(false);
        if (preferredSize != null) {
            setPreferredSize(preferredSize);
            historyView.setPreferredSize(preferredSize);
        }
        add(historyView, BorderLayout.CENTER);
    }

    public void render(com.lemondelila.client.game.history.model.GameHistoryTracker tracker, String emptyMessage) {
        historyView.render(tracker, emptyMessage);
    }

    public void clear() {
        historyView.setHistoryText("");
    }

    public void focusHistory() {
        historyView.focusHistory();
    }

    public javax.swing.JTextArea historyComponent() {
        return historyView.historyComponent();
    }

    public GameHistoryView view() {
        return historyView;
    }
}
