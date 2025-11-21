package com.lemondelila.client.game.catalog.view;

import com.lemondelila.client.framework.ui.keyboard.KeyboardBindings;

import javax.swing.BorderFactory;
import javax.swing.DefaultListModel;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.ListSelectionModel;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.util.List;
import java.util.function.Consumer;

public final class GameCatalogView {

    private final JPanel panel;
    private final JLabel status;
    private final DefaultListModel<String> categories = new DefaultListModel<>();
    private final DefaultListModel<String> subcategories = new DefaultListModel<>();
    private final DefaultListModel<String> games = new DefaultListModel<>();
    private final JList<String> catList;
    private final JList<String> subcatList;
    private final JList<String> gameList;
    private Consumer<Integer> onCategorySelected = i -> {};
    private Consumer<Integer> onSubCategorySelected = i -> {};
    private Consumer<Integer> onGameActivated = i -> {};

    public GameCatalogView() {
        this.panel = new JPanel(new BorderLayout(8, 8));
        this.status = new JLabel("Catalogue en cours de chargement...");

        catList = new JList<>(categories);
        catList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        KeyboardBindings.disableTabTraversal(catList);
        KeyboardBindings.bindEnter(catList, () -> onCategorySelected.accept(catList.getSelectedIndex()), "catalog.cat.enter");

        subcatList = new JList<>(subcategories);
        subcatList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        KeyboardBindings.disableTabTraversal(subcatList);
        KeyboardBindings.bindEnter(subcatList, () -> onSubCategorySelected.accept(subcatList.getSelectedIndex()), "catalog.sub.enter");

        gameList = new JList<>(games);
        gameList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        KeyboardBindings.disableTabTraversal(gameList);
        KeyboardBindings.bindEnter(gameList, () -> onGameActivated.accept(gameList.getSelectedIndex()), "catalog.game.enter");

        JPanel lists = new JPanel(new GridLayout(1, 3, 8, 8));
        lists.add(wrap("Catégories", catList));
        lists.add(wrap("Sous-catégories", subcatList));
        lists.add(wrap("Jeux", gameList));

        panel.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));
        panel.add(status, BorderLayout.NORTH);
        panel.add(lists, BorderLayout.CENTER);
    }

    private static JComponent wrap(String title, JList<String> list) {
        JPanel p = new JPanel(new BorderLayout());
        JLabel label = new JLabel(title);
        p.add(label, BorderLayout.NORTH);
        p.add(new JScrollPane(list), BorderLayout.CENTER);
        return p;
    }

    public JComponent component() {
        return panel;
    }

    public void setStatus(String text) {
        status.setText(text == null ? "" : text);
    }

    public void setCategories(List<String> values) {
        categories.clear();
        if (values != null) {
            values.forEach(categories::addElement);
        }
    }

    public void setSubcategories(List<String> values) {
        subcategories.clear();
        if (values != null) {
            values.forEach(subcategories::addElement);
        }
    }

    public void setGames(List<String> values) {
        games.clear();
        if (values != null) {
            values.forEach(games::addElement);
        }
    }

    public void onCategorySelected(Consumer<Integer> callback) {
        this.onCategorySelected = callback == null ? i -> {} : callback;
    }

    public void onSubCategorySelected(Consumer<Integer> callback) {
        this.onSubCategorySelected = callback == null ? i -> {} : callback;
    }

    public void onGameActivated(Consumer<Integer> callback) {
        this.onGameActivated = callback == null ? i -> {} : callback;
    }

    public void selectCategory(int index) {
        if (index >= 0 && index < categories.size()) {
            catList.setSelectedIndex(index);
            catList.ensureIndexIsVisible(index);
            onCategorySelected.accept(index);
        } else {
            catList.clearSelection();
            onCategorySelected.accept(-1);
        }
    }

    public void selectSubcategory(int index) {
        if (index >= 0 && index < subcategories.size()) {
            subcatList.setSelectedIndex(index);
            subcatList.ensureIndexIsVisible(index);
            onSubCategorySelected.accept(index);
        } else {
            subcatList.clearSelection();
            onSubCategorySelected.accept(-1);
        }
    }

    public void focusCategories() {
        catList.requestFocusInWindow();
    }

    public void focusSubcategories() {
        subcatList.requestFocusInWindow();
    }

    public void selectGame(int index) {
        if (index >= 0 && index < games.size()) {
            gameList.setSelectedIndex(index);
            gameList.ensureIndexIsVisible(index);
        } else {
            gameList.clearSelection();
        }
    }

    public void focusGames() {
        if (games.size() > 0 && gameList.getSelectedIndex() == -1) {
            gameList.setSelectedIndex(0);
            gameList.ensureIndexIsVisible(0);
        }
        gameList.requestFocusInWindow();
    }
}
