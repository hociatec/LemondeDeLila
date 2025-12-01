package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.gamelogic.panierexpress.service.PanierPlayerItems;

import javax.swing.BorderFactory;
import javax.swing.DefaultListModel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JLabel;
import javax.swing.JTextArea;
import java.awt.BorderLayout;
import java.util.List;
import java.util.Objects;

/**
 * Panneau latéral utilisé pour annoncer rapidement le contenu du panier ou de l'inventaire.
 */
final class PanierExpressInventoryPanel extends JPanel {

    enum ViewMode {
        NONE, BASKET, INVENTORY
    }

    private final JLabel titleLabel = new JLabel("Inventaire");
    private final DefaultListModel<String> itemsModel = new DefaultListModel<>();
    private final JList<String> itemsList = new JList<>(itemsModel);
    private final JTextArea infoArea = new JTextArea();
    private ViewMode mode = ViewMode.NONE;
    private PanierPlayerItems currentItems;

    PanierExpressInventoryPanel() {
        super(new BorderLayout(6, 6));
        setBorder(BorderFactory.createTitledBorder("Inventaire"));
        itemsList.setFocusable(true);
        itemsList.getAccessibleContext().setAccessibleName("Liste des éléments");
        itemsList.getAccessibleContext().setAccessibleDescription("Utilisez Haut et Bas pour parcourir les éléments.");
        JScrollPane scroll = new JScrollPane(itemsList);
        add(titleLabel, BorderLayout.NORTH);
        add(scroll, BorderLayout.CENTER);

        infoArea.setEditable(false);
        infoArea.setOpaque(false);
        infoArea.setLineWrap(true);
        infoArea.setWrapStyleWord(true);
        infoArea.setFocusable(false);
        infoArea.getAccessibleContext().setAccessibleName("Informations inventaire");
        add(infoArea, BorderLayout.SOUTH);

        showPlaceholder("Aucune information disponible.");
        setVisible(false);
    }

    void updateItems(PanierPlayerItems items) {
        this.currentItems = items;
        if (isVisible() && mode != ViewMode.NONE) {
            render();
        }
    }

    void showBasket() {
        if (currentItems == null) {
            showPlaceholder("Panier indisponible pour le moment.");
            setVisible(true);
            return;
        }
        this.mode = ViewMode.BASKET;
        setVisible(true);
        render();
    }

    void showInventory() {
        if (currentItems == null) {
            showPlaceholder("Inventaire indisponible pour le moment.");
            setVisible(true);
            return;
        }
        this.mode = ViewMode.INVENTORY;
        setVisible(true);
        render();
    }

    void hidePanel() {
        this.mode = ViewMode.NONE;
        setVisible(false);
    }

    private void render() {
        if (currentItems == null) {
            showPlaceholder("Aucune donnée à afficher.");
            return;
        }
        List<String> lines = mode == ViewMode.BASKET
                ? currentItems.basket()
                : currentItems.inventory();
        String title = mode == ViewMode.BASKET ? "Panier" : "Inventaire";
        titleLabel.setText(title + " de " + Objects.requireNonNullElse(currentItems.username(), "vous"));
        setBorder(BorderFactory.createTitledBorder(title));
        itemsModel.clear();
        if (lines == null || lines.isEmpty()) {
            itemsModel.addElement(mode == ViewMode.BASKET
                    ? "Panier vide."
                    : "Inventaire vide.");
            infoArea.setText("Aucun élément à lire.");
        } else {
            lines.forEach(itemsModel::addElement);
            StringBuilder builder = new StringBuilder();
            builder.append("Éléments listés : ").append(lines.size()).append(". ");
            builder.append("Utilisez Échap pour masquer ce panneau.");
            if (mode == ViewMode.INVENTORY) {
                List<String> remaining = currentItems.shoppingList();
                if (remaining != null && !remaining.isEmpty()) {
                    builder.append("\nArticles restants sur la liste : ").append(remaining.size()).append('.');
                }
            }
            infoArea.setText(builder.toString());
        }
    }

    private void showPlaceholder(String text) {
        itemsModel.clear();
        itemsModel.addElement(text);
        infoArea.setText("Appuyez sur P pour le panier ou I pour l'inventaire.");
    }
}
