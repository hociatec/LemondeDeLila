package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.framework.access.AccessibleDecorator;
import com.lemondelila.framework.access.AccessibleSpec;

import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import java.awt.BorderLayout;

/**
 * Historique des actions Panier Express.
 */
final class PanierExpressHistoryPanel extends JPanel {

    private final JTextArea historyArea = new JTextArea();

    PanierExpressHistoryPanel() {
        super(new BorderLayout());
        buildUi();
    }

    private void buildUi() {
        historyArea.setEditable(false);
        historyArea.setLineWrap(true);
        historyArea.setWrapStyleWord(true);
        historyArea.setFocusable(true);
        AccessibleDecorator.apply(historyArea, AccessibleSpec.builder()
                .name("Historique des actions")
                .description("Liste des derniers évènements de la partie Panier Express.")
                .build());

        JScrollPane scrollPane = new JScrollPane(historyArea);
        scrollPane.setBorder(javax.swing.BorderFactory.createTitledBorder("Historique"));
        add(scrollPane, BorderLayout.CENTER);
        setFocusable(false);
    }

    void setHistory(String text, String accessibleDescription) {
        historyArea.setText(text == null ? "" : text);
        if (accessibleDescription != null) {
            historyArea.getAccessibleContext().setAccessibleDescription(accessibleDescription);
        }
    }

    void focusHistory() {
        historyArea.requestFocusInWindow();
    }
}

