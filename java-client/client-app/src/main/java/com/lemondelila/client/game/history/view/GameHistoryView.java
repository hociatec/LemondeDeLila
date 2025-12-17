package com.lemondelila.client.game.history.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.AccessibilityPreferences;
import com.lemondelila.client.game.history.model.GameHistoryTracker;

import javax.swing.BorderFactory;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import java.awt.BorderLayout;
import java.util.Objects;

public final class GameHistoryView extends JPanel {

    private final JTextArea historyArea = new JTextArea();
    private boolean accessibilityToggle;

    public GameHistoryView(String title, String accessibleName, String accessibleDescription) {
        super(new BorderLayout());
        buildUi(title, accessibleName, accessibleDescription);
    }

    private void buildUi(String title, String accessibleName, String accessibleDescription) {
        historyArea.setEditable(false);
        historyArea.setLineWrap(false); // pas de coupure automatique pour garder les messages sur une seule ligne
        historyArea.setWrapStyleWord(false);
        historyArea.setColumns(60);
        historyArea.setFocusable(true);
        AccessibleDecorator.apply(historyArea, AccessibleSpec.builder()
                .name(accessibleName != null ? accessibleName : "Historique de la partie")
                .description(accessibleDescription != null ? accessibleDescription : "")
                .build());

        JScrollPane scrollPane = new JScrollPane(historyArea);
        scrollPane.setHorizontalScrollBarPolicy(JScrollPane.HORIZONTAL_SCROLLBAR_AS_NEEDED);
        if (title != null && !title.isBlank()) {
            scrollPane.setBorder(BorderFactory.createTitledBorder(title));
        } else {
            scrollPane.setBorder(BorderFactory.createEmptyBorder());
        }
        add(scrollPane, BorderLayout.CENTER);
        setFocusable(false);
    }

    public void render(GameHistoryTracker tracker, String emptyMessage) {
        Objects.requireNonNull(tracker, "tracker");
        String text = tracker.formatAll();
        if (text.isBlank() && emptyMessage != null) {
            text = emptyMessage;
        }
        applyHistoryText(text);
    }

    public void setHistoryText(String text) {
        applyHistoryText(text == null ? "" : text);
    }

    public void focusHistory() {
        historyArea.requestFocusInWindow();
    }

    public JTextArea historyComponent() {
        return historyArea;
    }

    private void applyHistoryText(String text) {
        String value = text == null ? "" : text;
        historyArea.setText(value);
        // Force la mise � jour c�t� lecteur d'�cran m�me si le contenu est identique.
        String payload = accessibilityToggle ? value + '\u200B' : value + '\u200C';
        accessibilityToggle = !accessibilityToggle;
        AccessibilityPreferences.applyDescription(historyArea.getAccessibleContext(), payload);
    }
}
