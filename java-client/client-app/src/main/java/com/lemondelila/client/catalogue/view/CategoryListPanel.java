package com.lemondelila.client.catalogue.view;

import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;

import javax.swing.JList;
import javax.swing.ListCellRenderer;

final class CategoryListPanel extends AbstractCatalogListPanel<CategoryListPanel.CategoryItem> {

    static final String CARD = "categories";

    CategoryListPanel(SoundEffectManager soundManager) {
        super("Categories", AccessibleSpec.builder()
                .name("Liste des catégories")
                .description("Sélectionnez une catégorie et validez avec Entrée pour afficher son contenu")
                .build(), soundManager);
    }

    @Override
    protected ListCellRenderer<CategoryItem> createRenderer() {
        return new CategoryItemRenderer();
    }

    CategoryItem selectedItem() {
        return super.selectedItem();
    }

    int selectedIndex() {
        return super.selectedIndex();
    }

    record CategoryItem(String id, String label, boolean hasChildren, int gameCount) {
    }

    private static final class CategoryItemRenderer extends javax.swing.DefaultListCellRenderer {
        @Override
        public java.awt.Component getListCellRendererComponent(JList<?> list,
                                                               Object value,
                                                               int index,
                                                               boolean isSelected,
                                                               boolean cellHasFocus) {
            String text = " ";
            if (value instanceof CategoryItem item) {
                StringBuilder builder = new StringBuilder(item.label());
                if (item.hasChildren()) {
                    builder.append(" (sous-categories)");
                }
                if (item.gameCount() > 0) {
                    builder.append(" - ").append(item.gameCount()).append(" jeu(x)");
                }
                text = builder.toString();
            }
            return super.getListCellRendererComponent(list, text, index, isSelected, cellHasFocus);
        }
    }
}
