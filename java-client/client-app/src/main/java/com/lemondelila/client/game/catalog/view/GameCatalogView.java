package com.lemondelila.client.game.catalog.view;

import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import java.awt.BorderLayout;

public final class GameCatalogView {

    private final JPanel panel;
    private final JLabel status;
    private final JTextArea body;

    public GameCatalogView() {
        this.panel = new JPanel(new BorderLayout(8, 8));
        this.status = new JLabel("Catalogue en cours de chargement...");
        this.body = new JTextArea();
        this.body.setEditable(false);
        this.body.setLineWrap(true);
        this.body.setWrapStyleWord(true);
        panel.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));
        panel.add(status, BorderLayout.NORTH);
        panel.add(new JScrollPane(body), BorderLayout.CENTER);
    }

    public JComponent component() {
        return panel;
    }

    public void setStatus(String text) {
        status.setText(text == null ? "" : text);
    }

    public void setBody(String text) {
        body.setText(text == null ? "" : text);
    }
}
