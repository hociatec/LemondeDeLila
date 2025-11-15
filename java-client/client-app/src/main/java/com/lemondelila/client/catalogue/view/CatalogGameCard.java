package com.lemondelila.client.catalogue.view;

import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;

import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JTextArea;
import javax.swing.ListCellRenderer;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Font;

/**
 * Tuile utilisée dans la liste des jeux pour proposer un rendu plus riche.
 */
final class CatalogGameCard extends JPanel implements ListCellRenderer<GameSummary> {

    private final JLabel title = new JLabel();
    private final JLabel meta = new JLabel();
    private final JTextArea summary = new JTextArea();

    CatalogGameCard() {
        super(new BorderLayout(8, 4));
        setBorder(new EmptyBorder(8, 10, 8, 10));
        title.setFont(title.getFont().deriveFont(Font.BOLD, 16f));
        AccessibleDecorator.apply(title, AccessibleSpec.builder()
                .name("Nom du jeu")
                .description("Nom du jeu présenté dans la liste.")
                .build());

        meta.setFont(meta.getFont().deriveFont(Font.PLAIN, 12f));
        meta.setForeground(new Color(80, 80, 80));
        AccessibleDecorator.apply(meta, AccessibleSpec.builder()
                .name("Informations de jeu")
                .description("Nombre de joueurs et catégories associées.")
                .build());

        summary.setLineWrap(true);
        summary.setWrapStyleWord(true);
        summary.setOpaque(false);
        summary.setEditable(false);
        summary.setFocusable(false);
        summary.setBorder(null);
        AccessibleDecorator.apply(summary, AccessibleSpec.builder()
                .name("Résumé du jeu")
                .description("Bref résumé du jeu.")
                .build());

        JPanel header = new JPanel(new BorderLayout());
        header.setOpaque(false);
        header.add(title, BorderLayout.WEST);
        header.add(meta, BorderLayout.EAST);

        add(header, BorderLayout.NORTH);
        add(summary, BorderLayout.CENTER);
    }

    @Override
    public Component getListCellRendererComponent(JList<? extends GameSummary> list,
                                                  GameSummary value,
                                                  int index,
                                                  boolean isSelected,
                                                  boolean cellHasFocus) {
        if (value != null) {
            title.setText(value.name());
            meta.setText(buildMeta(value));
            summary.setText(buildSummary(value));
            summary.getAccessibleContext().setAccessibleDescription(summary.getText());
        } else {
            title.setText(" ");
            meta.setText(" ");
            summary.setText(" ");
        }
        applySelectionColors(list, isSelected);
        return this;
    }

    private void applySelectionColors(JComponent list, boolean isSelected) {
        Color background = isSelected
                ? list.getSelectionBackground()
                : list.getBackground();
        Color foreground = isSelected
                ? list.getSelectionForeground()
                : list.getForeground();
        setBackground(background);
        setForeground(foreground);
        title.setForeground(foreground);
        meta.setForeground(isSelected ? foreground : new Color(90, 90, 90));
        summary.setForeground(foreground);
    }

    private String buildMeta(GameSummary summary) {
        StringBuilder builder = new StringBuilder();
        builder.append(summary.minPlayers()).append(" - ").append(summary.maxPlayers()).append(" joueurs");
        if (summary.categories() != null && !summary.categories().isEmpty()) {
            builder.append(" | ").append(String.join(", ", summary.categories()));
        }
        return builder.toString();
    }

    private String buildSummary(GameSummary summary) {
        String description = summary.summary();
        if (description == null || description.isBlank()) {
            return "Aucune description disponible.";
        }
        if (description.length() > 240) {
            return description.substring(0, 237).trim() + "...";
        }
        return description;
    }
}
