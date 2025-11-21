package com.lemondelila.client.game.catalog.view;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.core.event.DomainEventBus;
import com.lemondelila.client.framework.core.event.EventSubscriptions;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.catalog.controller.GameCatalogController;
import com.lemondelila.client.game.catalog.event.CatalogFailed;
import com.lemondelila.client.game.catalog.event.CatalogLoaded;
import com.lemondelila.client.game.catalog.model.CatalogCategory;
import com.lemondelila.client.game.catalog.model.CatalogGame;

import javax.swing.JPanel;
import java.awt.BorderLayout;
import java.util.Collections;
import java.util.List;

public final class GameCatalogScreen extends JPanel implements Screen, AutoCloseable {

    public static final ScreenId ID = ScreenId.of("catalog");

    private final GameCatalogView view;
    private final GameCatalogController controller;
    private final EventSubscriptions subscriptions = new EventSubscriptions();
    private List<CatalogCategory> currentCategories = Collections.emptyList();
    private List<CatalogGame> currentGames = Collections.emptyList();
    private List<CatalogCategory> currentSubCategories = Collections.emptyList();
    private int selectedCategoryIndex = -1;
    private CatalogCategory selectedSubCategory;
    private int selectedSubIndex = -1;
    private ScreenManager screenManager;

    @Inject
    public GameCatalogScreen(GameCatalogView view,
                             GameCatalogController controller,
                             DomainEventBus eventBus) {
        this.view = view;
        this.controller = controller;
        setLayout(new BorderLayout());
        add(view.component(), BorderLayout.CENTER);

        subscriptions.subscribe(eventBus, CatalogLoaded.class, ev -> {
            view.setStatus("Catalogue chargé");
            currentCategories = ev.payload().categories();
            currentGames = ev.payload().games();
            applyCategories();
            if (!currentCategories.isEmpty()) {
                view.selectCategory(0);
                view.focusCategories();
            }
        });
        subscriptions.subscribe(eventBus, CatalogFailed.class, ev -> {
            view.setStatus("Erreur de chargement");
            view.setGames(List.of());
            view.setSubcategories(List.of());
            view.setCategories(List.of());
        });

        view.onCategorySelected(this::onCategorySelected);
        view.onSubCategorySelected(this::onSubCategorySelected);
        view.onGameActivated(this::onGameActivated);
    }

    @Override
    public ScreenId id() {
        return ID;
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        controller.fetchAll();
        this.screenManager = context.screenManager();
        view.focusCategories();
    }

    @Override
    public void close() {
        subscriptions.close();
    }

    private void applyCategories() {
        List<String> labels = currentCategories.stream()
                .map(CatalogCategory::name)
                .toList();
        view.setCategories(labels);
        view.setSubcategories(List.of());
        view.setGames(List.of());
        selectedCategoryIndex = -1;
        currentSubCategories = Collections.emptyList();
        selectedSubCategory = null;
        selectedSubIndex = -1;
    }

    private void onCategorySelected(int index) {
        if (index < 0 || index >= currentCategories.size()) {
            view.setSubcategories(List.of());
            view.setGames(List.of());
            selectedCategoryIndex = -1;
            currentSubCategories = Collections.emptyList();
            selectedSubCategory = null;
            view.focusCategories();
            return;
        }
        CatalogCategory selected = currentCategories.get(index);
        selectedCategoryIndex = index;
        List<CatalogCategory> children = selected.children();
        currentSubCategories = children;
        selectedSubCategory = null;
        selectedSubIndex = -1;
        view.setSubcategories(children.stream().map(CatalogCategory::name).toList());
        if (children.isEmpty()) {
            List<CatalogGame> filtered = filterGames(selected.id());
            view.setGames(filtered.stream().map(CatalogGame::name).toList());
            selectedSubCategory = selected;
            selectedSubIndex = -1;
            view.selectSubcategory(-1);
            if (!filtered.isEmpty()) {
                view.selectGame(0);
            }
            view.focusGames();
        } else {
            view.setGames(List.of());
            view.selectSubcategory(0);
            view.focusSubcategories();
        }
    }

    private void onSubCategorySelected(int index) {
        if (index < 0 || index >= currentSubCategories.size()) {
            view.setGames(List.of());
            return;
        }
        CatalogCategory sub = currentSubCategories.get(index);
        selectedSubCategory = sub;
        selectedSubIndex = index;
        List<CatalogGame> filtered = filterGames(sub.id());
        view.setGames(filtered.stream().map(CatalogGame::name).toList());
        if (!filtered.isEmpty()) {
            view.selectGame(0);
        }
        view.focusGames();
    }

    private void onGameActivated(int index) {
        if (index < 0) {
            return;
        }
        List<CatalogGame> source = filterGames(
                selectedSubCategory != null ? selectedSubCategory.id()
                        : selectedCategoryIndex >= 0 && selectedCategoryIndex < currentCategories.size()
                        ? currentCategories.get(selectedCategoryIndex).id()
                        : null
        );
        if (index >= source.size()) {
            return;
        }
        CatalogGame game = source.get(index);
        String name = "Table " + game.name();
        int max = game.maxPlayers() > 0 ? game.maxPlayers() : 4;
        ControllerResult result = controller.createTableForGame(game.code(), name, max, true);
        if (result != null && result.statusMessage().isPresent()) {
            view.setStatus(result.statusMessage().orElse(""));
        }
        if (result != null && result.navigationTarget().isPresent() && screenManager != null) {
            screenManager.show(result.navigationTarget().get());
        }
    }

    private List<CatalogGame> filterGames(String categoryId) {
        if (categoryId == null || categoryId.isBlank()) {
            return Collections.emptyList();
        }
        return currentGames.stream()
                .filter(g -> g.categories() != null && g.categories().contains(categoryId))
                .toList();
    }
}
