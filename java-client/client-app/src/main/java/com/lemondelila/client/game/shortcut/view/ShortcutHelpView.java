package com.lemondelila.client.game.shortcut.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.game.shortcut.model.ShortcutEntry;

import javax.swing.BorderFactory;
import javax.swing.JLabel;
import javax.swing.JPanel;
import java.awt.BorderLayout;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Vue optionnelle pour afficher la liste des raccourcis disponibles.
 */
public final class ShortcutHelpView extends JPanel {

    private final JLabel label = new JLabel();

    public ShortcutHelpView(FocusHighlighter highlighter) {
        super(new BorderLayout());
        setBorder(BorderFactory.createTitledBorder("Raccourcis"));
        AccessibleDecorator.apply(label, AccessibleSpec.builder()
                .name("Raccourcis clavier")
                .description("Liste des raccourcis disponibles pour la table")
                .build());
        highlighter.apply(label);
        add(label, BorderLayout.CENTER);
    }

    public void render(List<ShortcutEntry> entries) {
        if (entries == null || entries.isEmpty()) {
            label.setText("Aucun raccourci enregistré.");
            return;
        }
        String text = entries.stream()
                .map(e -> e.key() + " : " + e.description())
                .collect(Collectors.joining("<br/>"));
        label.setText("<html>" + text + "</html>");
    }
}
