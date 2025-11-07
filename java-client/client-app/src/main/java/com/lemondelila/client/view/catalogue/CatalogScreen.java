package com.lemondelila.client.view.catalogue;

import com.lemondelila.client.controller.game.GameCatalogController;
import com.lemondelila.client.controller.game.GameInteractionController;
import com.lemondelila.client.model.catalogue.CatalogCategory;
import com.lemondelila.client.model.catalogue.CatalogData;
import com.lemondelila.client.service.catalogue.GameRulesService;
import com.lemondelila.client.model.catalogue.GameSummary;
import com.lemondelila.framework.ui.dialog.DialogService;
import com.lemondelila.framework.ui.screen.Screen;
import com.lemondelila.framework.ui.screen.ScreenContext;
import com.lemondelila.framework.ui.screen.ScreenManager;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.DefaultListCellRenderer;
import javax.swing.DefaultListModel;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.KeyStroke;
import javax.swing.ListSelectionModel;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

public final class CatalogScreen extends JPanel implements Screen {

    private static final String ROOT_CATEGORY = "__root__";
    private static final String ACTION_BACK = "catalog.back";

    private final GameCatalogController catalogController;
    private final DialogService dialogService;

    private final CardLayout viewLayout = new CardLayout();
    private final JPanel viewPanel = new JPanel(viewLayout);
    private final CategoryListPanel categoryListPanel = new CategoryListPanel();
    private final GameListPanel gameListPanel = new GameListPanel();
    private final GameDetailPanel gameDetailPanel = new GameDetailPanel();

    private final JLabel titleLabel = new JLabel("Etageres");
    private final JLabel breadcrumbLabel = new JLabel("Categories");
    private final JLabel statusLabel = new JLabel(" ");

    private ScreenManager screenManager;
    private boolean loading;
    private boolean loaded;

    private final Deque<ViewState> navigationStack = new ArrayDeque<>();

    private Map<String, CatalogCategory> categoryIndex = Map.of();
    private Map<String, List<CatalogCategory>> childrenIndex = Map.of();
    private Map<String, List<GameSummary>> gamesByCategory = Map.of();
    private Map<String, GameSummary> gameIndex = Map.of();
    private Map<String, String> categoryBreadcrumbs = Map.of();

    private GameSummary activeGame;
    private final GameInteractionController gameInteractionController;

    public CatalogScreen(GameCatalogController catalogController,
                         GameRulesService rulesService,
                         DialogService dialogService) {
        this.catalogController = Objects.requireNonNull(catalogController, "catalogController");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        buildUi();
        installActions();
        this.gameInteractionController = new GameInteractionController(
                gameDetailPanel,
                dialogService,
                rulesService,
                () -> Optional.ofNullable(activeGame),
                this::performBackNavigation,
                this::setStatus
        );
        gameInteractionController.setEnabled(false);
    }

    private void buildUi() {
        setLayout(new BorderLayout(16, 16));
        setBorder(BorderFactory.createEmptyBorder(32, 48, 32, 48));

        titleLabel.setFont(titleLabel.getFont().deriveFont(Font.BOLD, 26f));
        breadcrumbLabel.setFont(breadcrumbLabel.getFont().deriveFont(Font.ITALIC, 14f));

        JPanel titleContainer = new JPanel();
        titleContainer.setLayout(new BoxLayout(titleContainer, BoxLayout.Y_AXIS));
        titleContainer.setOpaque(false);
        titleContainer.add(titleLabel);
        titleContainer.add(Box.createRigidArea(new Dimension(0, 6)));
        titleContainer.add(breadcrumbLabel);

        JPanel header = new JPanel(new BorderLayout(12, 12));
        header.setOpaque(false);
        header.add(titleContainer, BorderLayout.WEST);
        add(header, BorderLayout.NORTH);

        viewPanel.setOpaque(false);
        viewPanel.add(categoryListPanel, CategoryListPanel.CARD);
        viewPanel.add(gameListPanel, GameListPanel.CARD);
        viewPanel.add(gameDetailPanel, GameDetailPanel.CARD);
        add(viewPanel, BorderLayout.CENTER);

        statusLabel.setBorder(BorderFactory.createEmptyBorder(8, 4, 0, 4));
        add(statusLabel, BorderLayout.SOUTH);
    }

    private void installActions() {
        categoryListPanel.onEnter(this::openSelectedCategory);
        gameListPanel.onEnter(this::openSelectedGame);

        getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("ESCAPE"), ACTION_BACK);
        getActionMap().put(ACTION_BACK, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                performBackNavigation();
            }
        });
    }

    private void openSelectedCategory() {
        if (navigationStack.isEmpty()) {
            return;
        }
        CategoryListPanel.CategoryItem item = categoryListPanel.selectedItem();
        if (item == null) {
            return;
        }
        ViewState current = navigationStack.peek();
        if (current != null) {
            current.selectedIndex = categoryListPanel.selectedIndex();
        }
        List<CatalogCategory> children = childrenIndex.getOrDefault(item.id(), List.of());
        if (!children.isEmpty()) {
            navigateTo(new ViewState(ViewMode.CATEGORIES, item.id()));
        } else {
            navigateTo(new ViewState(ViewMode.GAMES, item.id()));
        }
    }

    private void openSelectedGame() {
        if (navigationStack.isEmpty()) {
            return;
        }
        GameSummary game = gameListPanel.selectedItem();
        if (game == null) {
            return;
        }
        ViewState current = navigationStack.peek();
        if (current != null) {
            current.selectedIndex = gameListPanel.selectedIndex();
        }
        navigateTo(new ViewState(ViewMode.GAME, current.categoryId, game.code()));
    }

    private void navigateTo(ViewState next) {
        ViewState current = navigationStack.peek();
        if (current != null) {
            switch (current.mode) {
                case CATEGORIES -> current.selectedIndex = categoryListPanel.selectedIndex();
                case GAMES -> current.selectedIndex = gameListPanel.selectedIndex();
                case GAME -> { /* rien a memoriser */ }
            }
        }
        navigationStack.push(next);
        applyState(next);
    }

    private void applyState(ViewState state) {
        switch (state.mode) {
            case CATEGORIES -> showCategories(state);
            case GAMES -> showGames(state);
            case GAME -> showGame(state);
        }
    }

    private void showCategories(ViewState state) {
        gameInteractionController.setEnabled(false);
        activeGame = null;

        List<CatalogCategory> categories = childrenIndex.getOrDefault(state.categoryId, List.of());
        List<CategoryListPanel.CategoryItem> items = new ArrayList<>();
        for (CatalogCategory category : categories) {
            int gameCount = gamesByCategory.getOrDefault(category.id(), List.of()).size();
            boolean hasChildren = !category.children().isEmpty();
            items.add(new CategoryListPanel.CategoryItem(
                    category.id(),
                    category.name(),
                    hasChildren,
                    gameCount
            ));
        }
        categoryListPanel.show(items, state.selectedIndex);
        viewLayout.show(viewPanel, CategoryListPanel.CARD);
        SwingUtilities.invokeLater(categoryListPanel::requestFocusInWindow);

        if (ROOT_CATEGORY.equals(state.categoryId)) {
            breadcrumbLabel.setText("Categories");
            setStatus(categories.isEmpty()
                    ? "Aucune categorie disponible."
                    : categories.size() + " categorie(s) disponibles.");
        } else {
            String label = categoryBreadcrumbs.getOrDefault(state.categoryId, "Categorie");
            breadcrumbLabel.setText("Categorie : " + label);
            setStatus(categories.isEmpty()
                    ? "Aucune sous-categorie pour " + label + "."
                    : categories.size() + " sous-categorie(s) pour " + label + ".");
        }
    }

    private void showGames(ViewState state) {
        gameInteractionController.setEnabled(false);
        activeGame = null;

        List<GameSummary> games = gamesByCategory.getOrDefault(state.categoryId, List.of());
        gameListPanel.show(games, state.selectedIndex);
        viewLayout.show(viewPanel, GameListPanel.CARD);
        SwingUtilities.invokeLater(gameListPanel::requestFocusInWindow);

        String label = categoryBreadcrumbs.getOrDefault(state.categoryId, "Categorie");
        breadcrumbLabel.setText("Jeux : " + label);
        setStatus(games.isEmpty()
                ? "Aucun jeu dans " + label + "."
                : games.size() + " jeu(x) dans " + label + ".");
    }

    private void showGame(ViewState state) {
        GameSummary game = gameIndex.get(state.gameCode);
        if (game == null) {
            gameInteractionController.setEnabled(false);
            setStatus("Jeu introuvable.");
            return;
        }
        gameDetailPanel.show(game);
        viewLayout.show(viewPanel, GameDetailPanel.CARD);
        SwingUtilities.invokeLater(gameDetailPanel::requestFocusInWindow);
        activeGame = game;
        gameInteractionController.setEnabled(true);

        breadcrumbLabel.setText("Jeu : " + game.name());
        setStatus("Jeu pret. Ctrl+F1 pour voir les regles, Q pour quitter.");
    }

    private void performBackNavigation() {
        if (navigationStack.size() <= 1) {
            if (screenManager != null) {
                screenManager.show("main-menu");
            }
            return;
        }
        navigationStack.pop();
        ViewState previous = navigationStack.peek();
        if (previous != null) {
            applyState(previous);
        }
    }

    private void loadCatalog(boolean forceReload) {
        if (loading) {
            return;
        }
        if (loaded && !forceReload) {
            return;
        }
        loading = true;
        setStatus("Chargement du catalogue...");
        setLoadingState(true);

        catalogController.loadCatalog().whenComplete((catalog, error) -> SwingUtilities.invokeLater(() -> {
            loading = false;
            setLoadingState(false);
            if (error != null || catalog == null) {
                dialogService.error("Catalogue indisponible",
                        "Impossible de charger le catalogue pour le moment.");
                setStatus("Erreur lors du chargement du catalogue.");
                return;
            }
            applyCatalog(catalog);
            loaded = true;
        }));
    }

    private void applyCatalog(CatalogData catalog) {
        Map<String, CatalogCategory> newCategoryIndex = new LinkedHashMap<>();
        Map<String, List<CatalogCategory>> newChildrenIndex = new LinkedHashMap<>();
        indexCategories(catalog.categories(), ROOT_CATEGORY, newCategoryIndex, newChildrenIndex);

        Map<String, List<GameSummary>> newGamesByCategory = new LinkedHashMap<>();
        Map<String, GameSummary> newGameIndex = new LinkedHashMap<>();
        for (GameSummary game : catalog.games()) {
            newGameIndex.put(game.code(), game);
            for (String categoryId : game.categories()) {
                newGamesByCategory
                        .computeIfAbsent(categoryId, key -> new ArrayList<>())
                        .add(game);
            }
        }

        newChildrenIndex.replaceAll((id, list) -> List.copyOf(list));
        newGamesByCategory.replaceAll((id, list) -> List.copyOf(list));

        categoryIndex = Map.copyOf(newCategoryIndex);
        childrenIndex = Map.copyOf(newChildrenIndex);
        gamesByCategory = Map.copyOf(newGamesByCategory);
        gameIndex = Map.copyOf(newGameIndex);
        categoryBreadcrumbs = buildBreadcrumbs(catalog.categories());

        navigationStack.clear();
        navigationStack.push(new ViewState(ViewMode.CATEGORIES, ROOT_CATEGORY));
        applyState(navigationStack.peek());
    }

    private void indexCategories(List<CatalogCategory> categories,
                                 String parentId,
                                 Map<String, CatalogCategory> index,
                                 Map<String, List<CatalogCategory>> children) {
        List<CatalogCategory> bucket = children.computeIfAbsent(parentId, key -> new ArrayList<>());
        for (CatalogCategory category : categories) {
            index.put(category.id(), category);
            bucket.add(category);
            indexCategories(category.children(), category.id(), index, children);
        }
    }

    private Map<String, String> buildBreadcrumbs(List<CatalogCategory> categories) {
        Map<String, String> breadcrumbs = new LinkedHashMap<>();
        for (CatalogCategory category : categories) {
            accumulateBreadcrumbs(breadcrumbs, category, "");
        }
        return Map.copyOf(breadcrumbs);
    }

    private void accumulateBreadcrumbs(Map<String, String> breadcrumbs,
                                       CatalogCategory category,
                                       String prefix) {
        String path = prefix.isEmpty() ? category.name() : prefix + " / " + category.name();
        breadcrumbs.put(category.id(), path);
        for (CatalogCategory child : category.children()) {
            accumulateBreadcrumbs(breadcrumbs, child, path);
        }
    }

    private void setLoadingState(boolean busy) {
        categoryListPanel.setEnabled(!busy);
        gameListPanel.setEnabled(!busy);
        gameDetailPanel.setEnabled(!busy);
    }

    private void setStatus(String text) {
        SwingUtilities.invokeLater(() -> statusLabel.setText(text));
    }

    @Override
    public String id() {
        return "catalog";
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        dialogService.attach(this);
        if (loaded) {
            ViewState current = navigationStack.peek();
            if (current != null) {
                applyState(current);
                return;
            }
        }
        loadCatalog(false);
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        gameInteractionController.setEnabled(false);
        activeGame = null;
    }

    private enum ViewMode {
        CATEGORIES,
        GAMES,
        GAME
    }

    private static final class ViewState {
        final ViewMode mode;
        final String categoryId;
        final String gameCode;
        int selectedIndex;

        ViewState(ViewMode mode, String categoryId) {
            this(mode, categoryId, null);
        }

        ViewState(ViewMode mode, String categoryId, String gameCode) {
            this.mode = mode;
            this.categoryId = categoryId;
            this.gameCode = gameCode;
            this.selectedIndex = 0;
        }
    }

    private static final class CategoryListPanel extends JPanel {

        static final String CARD = "categories";

        private final DefaultListModel<CategoryItem> model = new DefaultListModel<>();
        private final JList<CategoryItem> list = new JList<>(model);

        CategoryListPanel() {
            setLayout(new BorderLayout());
            setOpaque(false);
            list.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
            list.setVisibleRowCount(-1);
            list.setFocusTraversalKeysEnabled(false);
            list.setCellRenderer(new CategoryItemRenderer());
            JScrollPane scroll = new JScrollPane(list);
            scroll.setBorder(BorderFactory.createTitledBorder("Categories"));
            add(scroll, BorderLayout.CENTER);
        }

        void show(List<CategoryItem> items, int selectedIndex) {
            model.clear();
            for (CategoryItem item : items) {
                model.addElement(item);
            }
            if (!items.isEmpty()) {
                int index = Math.max(0, Math.min(selectedIndex, items.size() - 1));
                list.setSelectedIndex(index);
                list.ensureIndexIsVisible(index);
            } else {
                list.clearSelection();
            }
        }

        void onEnter(Runnable action) {
            Objects.requireNonNull(action, "action");
            list.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "open");
            list.getActionMap().put("open", new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    action.run();
                }
            });
        }

        CategoryItem selectedItem() {
            return list.getSelectedValue();
        }

        int selectedIndex() {
            return list.getSelectedIndex();
        }

        @Override
        public void setEnabled(boolean enabled) {
            super.setEnabled(enabled);
            list.setEnabled(enabled);
        }

        @Override
        public boolean requestFocusInWindow() {
            return list.requestFocusInWindow();
        }

        record CategoryItem(String id, String label, boolean hasChildren, int gameCount) {
        }

        private static final class CategoryItemRenderer extends DefaultListCellRenderer {
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
                        builder.append(" ->");
                    }
                    if (item.gameCount() > 0) {
                        builder.append(" (").append(item.gameCount()).append(" jeu");
                        if (item.gameCount() > 1) {
                            builder.append("x");
                        }
                        builder.append(")");
                    }
                    text = builder.toString();
                }
                return super.getListCellRendererComponent(list, text, index, isSelected, cellHasFocus);
            }
        }
    }

    private static final class GameListPanel extends JPanel {

        static final String CARD = "games";

        private final DefaultListModel<GameSummary> model = new DefaultListModel<>();
        private final JList<GameSummary> list = new JList<>(model);

        GameListPanel() {
            setLayout(new BorderLayout());
            setOpaque(false);
            list.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
            list.setVisibleRowCount(-1);
            list.setFocusTraversalKeysEnabled(false);
            list.setCellRenderer(new GameSummaryRenderer());
            JScrollPane scroll = new JScrollPane(list);
            scroll.setBorder(BorderFactory.createTitledBorder("Jeux disponibles"));
            add(scroll, BorderLayout.CENTER);
        }

        void show(List<GameSummary> games, int selectedIndex) {
            model.clear();
            for (GameSummary game : games) {
                model.addElement(game);
            }
            if (!games.isEmpty()) {
                int index = Math.max(0, Math.min(selectedIndex, games.size() - 1));
                list.setSelectedIndex(index);
                list.ensureIndexIsVisible(index);
            } else {
                list.clearSelection();
            }
        }

        void onEnter(Runnable action) {
            Objects.requireNonNull(action, "action");
            list.getInputMap(JComponent.WHEN_FOCUSED).put(KeyStroke.getKeyStroke("ENTER"), "select");
            list.getActionMap().put("select", new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    action.run();
                }
            });
        }

        GameSummary selectedItem() {
            return list.getSelectedValue();
        }

        int selectedIndex() {
            return list.getSelectedIndex();
        }

        @Override
        public void setEnabled(boolean enabled) {
            super.setEnabled(enabled);
            list.setEnabled(enabled);
        }

        @Override
        public boolean requestFocusInWindow() {
            return list.requestFocusInWindow();
        }

        private static final class GameSummaryRenderer extends DefaultListCellRenderer {
            @Override
            public java.awt.Component getListCellRendererComponent(JList<?> list,
                                                                   Object value,
                                                                   int index,
                                                                   boolean isSelected,
                                                                   boolean cellHasFocus) {
                String text = value instanceof GameSummary summary
                        ? summary.displayLabel()
                        : " ";
                return super.getListCellRendererComponent(list, text, index, isSelected, cellHasFocus);
            }
        }
    }

    private static final class GameDetailPanel extends JPanel {

        static final String CARD = "game";

        private final JLabel nameLabel = new JLabel("Selectionnez un jeu");
        private final javax.swing.JTextArea summaryArea = new javax.swing.JTextArea();

        GameDetailPanel() {
            setLayout(new BorderLayout());
            setOpaque(false);
            setFocusable(true);

            nameLabel.setFont(nameLabel.getFont().deriveFont(Font.BOLD, 22f));
            summaryArea.setEditable(false);
            summaryArea.setLineWrap(true);
            summaryArea.setWrapStyleWord(true);
            summaryArea.setFocusable(false);
            summaryArea.setOpaque(false);

            JScrollPane summaryScroll = new JScrollPane(summaryArea);
            summaryScroll.setBorder(BorderFactory.createTitledBorder("Description"));
            summaryScroll.setOpaque(false);
            summaryScroll.getViewport().setOpaque(false);
            summaryScroll.setPreferredSize(new Dimension(0, 200));

            JPanel content = new JPanel();
            content.setLayout(new BoxLayout(content, BoxLayout.Y_AXIS));
            content.setOpaque(false);
            content.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));
            content.add(nameLabel);
            content.add(Box.createRigidArea(new Dimension(0, 12)));
            content.add(summaryScroll);

            add(content, BorderLayout.CENTER);
        }

        void show(GameSummary game) {
            nameLabel.setText(game.name());
            String summary = game.summary();
            if (summary == null || summary.isBlank()) {
                summaryArea.setText("Aucune description n'est disponible pour ce jeu.");
            } else {
                summaryArea.setText(summary);
            }
            summaryArea.setCaretPosition(0);
        }

        @Override
        public void setEnabled(boolean enabled) {
            super.setEnabled(enabled);
            summaryArea.setEnabled(enabled);
        }
    }
}




