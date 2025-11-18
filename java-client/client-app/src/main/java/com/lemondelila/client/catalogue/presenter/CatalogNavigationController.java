package com.lemondelila.client.catalogue.presenter;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.catalogue.model.CatalogCategory;
import com.lemondelila.client.catalogue.model.GameSummary;

import javax.swing.SwingUtilities;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

/**
 * Gère la navigation (pile, vues, rechargements) du catalogue.
 */
final class CatalogNavigationController {

    private enum ViewMode {
        CATEGORIES,
        GAMES
    }

    private static final class ViewState {
        final ViewMode mode;
        final String categoryId;
        int selectedIndex;

        ViewState(ViewMode mode, String categoryId) {
            this.mode = mode;
            this.categoryId = categoryId;
            this.selectedIndex = 0;
        }
    }

    private final CatalogDataIndex dataIndex;
    private final CatalogViewPort view;
    private final CatalogDataLoader dataLoader;
    private final Consumer<GameSummary> selectionListener;

    private final Deque<ViewState> navigationStack = new ArrayDeque<>();

    CatalogNavigationController(CatalogDataIndex dataIndex,
                                CatalogViewPort view,
                                CatalogDataLoader dataLoader,
                                Consumer<GameSummary> selectionListener) {
        this.dataIndex = Objects.requireNonNull(dataIndex, "dataIndex");
        this.view = Objects.requireNonNull(view, "view");
        this.dataLoader = Objects.requireNonNull(dataLoader, "dataLoader");
        this.selectionListener = Objects.requireNonNull(selectionListener, "selectionListener");
    }

    void showRoot() {
        navigationStack.clear();
        navigationStack.push(new ViewState(ViewMode.CATEGORIES, CatalogDataIndex.ROOT_CATEGORY));
        renderCurrent();
    }

    void refreshCurrent() {
        if (navigationStack.isEmpty()) {
            showRoot();
            return;
        }
        renderCurrent();
    }

    void openCategory(String categoryId, int previousSelectionIndex) {
        if (categoryId == null) {
            return;
        }
        ViewState current = navigationStack.peek();
        if (current != null) {
            current.selectedIndex = Math.max(0, previousSelectionIndex);
        }
        List<CatalogCategory> children = dataIndex.childrenOf(categoryId);
        ViewMode nextMode = children.isEmpty() ? ViewMode.GAMES : ViewMode.CATEGORIES;
        navigationStack.push(new ViewState(nextMode, categoryId));
        renderCurrent();
    }

    boolean navigateBack() {
        if (navigationStack.size() <= 1) {
            return false;
        }
        navigationStack.pop();
        renderCurrent();
        return true;
    }

    void updateGameSelectionIndex(int index) {
        ViewState state = navigationStack.peek();
        if (state != null && state.mode == ViewMode.GAMES) {
            state.selectedIndex = Math.max(0, index);
        }
    }

    boolean hasState() {
        return !navigationStack.isEmpty();
    }

    private void renderCurrent() {
        ViewState state = navigationStack.peek();
        if (state == null) {
            return;
        }
        switch (state.mode) {
            case CATEGORIES -> renderCategories(state);
            case GAMES -> renderGames(state);
        }
    }

    private void renderCategories(ViewState state) {
        view.playNavigateSound();
        List<CatalogCategory> categories = dataIndex.childrenOf(state.categoryId);
        List<CatalogCategoryItem> items = new ArrayList<>();
        for (CatalogCategory category : categories) {
            int gameCount = dataIndex.gamesOf(category.id()).size();
            boolean hasChildren = !category.children().isEmpty();
            items.add(new CatalogCategoryItem(
                    category.id(),
                    category.name(),
                    hasChildren,
                    gameCount
            ));
        }
        boolean root = CatalogDataIndex.ROOT_CATEGORY.equals(state.categoryId);
        String label = dataIndex.breadcrumbLabel(state.categoryId);
        String breadcrumb = root
                ? Internationalization.text("catalog.nav.breadcrumb.root")
                : Internationalization.text("catalog.nav.breadcrumb.category", label);
        String status = categories.isEmpty()
                ? (root
                ? Internationalization.text("catalog.nav.status.root.empty")
                : Internationalization.text("catalog.nav.status.child.empty", label))
                : (root
                ? Internationalization.text("catalog.nav.status.root.count", categories.size())
                : Internationalization.text("catalog.nav.status.child.count", categories.size(), label));
        view.showCategories(items, state.selectedIndex, breadcrumb, status);
        selectionListener.accept(null);
    }

    private void renderGames(ViewState state) {
        view.playNavigateSound();
        List<GameSummary> games = dataIndex.gamesOf(state.categoryId);
        String label = dataIndex.breadcrumbLabel(state.categoryId);
        String breadcrumb = Internationalization.text("catalog.nav.breadcrumb.games", label);
        String status = games.isEmpty()
                ? Internationalization.text("catalog.nav.status.games.empty", label)
                : Internationalization.text("catalog.nav.status.games.count", games.size(), label);
        view.showGames(games, state.selectedIndex, breadcrumb, status);
        propagateSelectionFromIndex(state, games);
        if (games.isEmpty()) {
            requestGamesForCategory(state, label);
        }
    }

    private void propagateSelectionFromIndex(ViewState state, List<GameSummary> games) {
        if (games.isEmpty()) {
            selectionListener.accept(null);
            return;
        }
        int index = Math.max(0, Math.min(state.selectedIndex, games.size() - 1));
        state.selectedIndex = index;
    }

    private void requestGamesForCategory(ViewState state, String label) {
        dataLoader.loadGamesForCategory(state.categoryId).whenComplete((result, error) ->
                SwingUtilities.invokeLater(() -> {
                    if (error != null || result == null || result.isEmpty()) {
                        view.setStatus(Internationalization.text("catalog.status.no.games", label));
                        selectionListener.accept(null);
                        return;
                    }
                    if (navigationStack.peek() == state) {
                        state.selectedIndex = Math.min(state.selectedIndex, Math.max(result.size() - 1, 0));
                        renderGames(state);
                    }
                }));
    }
}

