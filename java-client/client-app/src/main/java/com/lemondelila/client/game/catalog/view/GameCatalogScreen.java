package com.lemondelila.client.game.catalog.view;

import com.lemondelila.client.menu.view.MainMenuScreen;
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
import com.lemondelila.client.game.shortcut.controller.TableShortcutManager;

import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
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
    private boolean gamesVisible = false;
    private boolean programmaticSelection = false;
    private boolean userNavigated = false;
    private final TableShortcutManager shortcuts;

    @Inject
    public GameCatalogScreen(GameCatalogView view,
                             GameCatalogController controller,
                             DomainEventBus eventBus,
                             TableShortcutManager shortcuts) {
        this.view = view;
        this.controller = controller;
        this.shortcuts = shortcuts;
        setLayout(new BorderLayout());
        add(view.component(), BorderLayout.CENTER);

        subscriptions.subscribe(eventBus, CatalogLoaded.class, ev -> {
            view.setStatus("Catalogue charge");
            currentCategories = dedupeCategories(ev.payload().categories());
            currentGames = dedupeGames(ev.payload().games());
            applyCategories();
            if (!currentCategories.isEmpty()) {
                withProgrammatic(() -> view.selectCategory(0));
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

        // Raccourci Échap : remonter ou sortir du catalogue.
        shortcuts.bindEscape(view.component(), this::onEscape);
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
        this.screenManager = context.screenManager();
        shortcuts.bindEscape(view.component(), this::onEscape);
        if (currentCategories.isEmpty() && currentGames.isEmpty()) {
            controller.fetchAll();
        }
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
        gamesVisible = false;
    }

    private void onCategorySelected(int index) {
        if (!programmaticSelection) {
            userNavigated = true;
        }
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
        List<CatalogCategory> children = dedupeCategories(selected.children());
        currentSubCategories = children;
        selectedSubCategory = null;
        selectedSubIndex = -1;
        view.setSubcategories(dedupeCategoryNames(children));
        if (children.isEmpty()) {
            List<CatalogGame> filtered = filterGames(selected.id());
            view.setGames(dedupeGameNames(filtered));
            selectedSubCategory = selected;
            selectedSubIndex = -1;
            withProgrammatic(() -> view.selectSubcategory(-1));
            gamesVisible = !filtered.isEmpty();
            if (!filtered.isEmpty()) {
                withProgrammatic(() -> view.selectGame(0));
            }
            view.focusGames();
        } else {
            view.setGames(List.of());
            withProgrammatic(() -> view.selectSubcategory(0));
            view.focusSubcategories();
            gamesVisible = false;
        }
    }

    private void onSubCategorySelected(int index) {
        if (!programmaticSelection) {
            userNavigated = true;
        }
        if (index < 0 || index >= currentSubCategories.size()) {
            view.setGames(List.of());
            gamesVisible = false;
            return;
        }
        CatalogCategory sub = currentSubCategories.get(index);
        selectedSubCategory = sub;
        selectedSubIndex = index;
        List<CatalogGame> filtered = filterGames(sub.id());
        view.setGames(dedupeGameNames(filtered));
        gamesVisible = !filtered.isEmpty();
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

    /**
     * Raccourci Echap : remonte l'arborescence.
     * - Si des jeux sont visibles => on les masque et on revient au niveau sous-cat/cat.
     * - Dans tous les autres cas => retour direct au menu principal.
     */
    private void onEscape() {
        // Si l'utilisateur n'a pas navigué (sélection initiale auto) et qu'aucune liste de jeux n'est visible,
        // on quitte directement.
        if (!userNavigated && !gamesVisible) {
            if (screenManager != null) {
                screenManager.show(MainMenuScreen.ID);
            }
            return;
        }
        if (gamesVisible) {
            view.setGames(List.of());
            gamesVisible = false;
            if (!currentSubCategories.isEmpty()) {
                view.focusSubcategories();
            } else {
                view.focusCategories();
            }
            return;
        }
        // Si des sous-categories sont ouvertes ET qu'on est réellement dans ce niveau (selection sous-cat),
        // on remonte d'un cran. Sinon on sort directement.
        if (!currentSubCategories.isEmpty() && (selectedSubCategory != null || selectedSubIndex >= 0)) {
            currentSubCategories = Collections.emptyList();
            selectedSubCategory = null;
            selectedSubIndex = -1;
            view.setSubcategories(List.of());
            view.setGames(List.of());
            gamesVisible = false;
            view.focusCategories();
            return;
        }
        if (screenManager != null) {
            screenManager.show(MainMenuScreen.ID);
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

    private List<CatalogCategory> dedupeCategories(List<CatalogCategory> source) {
        if (source == null || source.isEmpty()) {
            return List.of();
        }
        java.util.LinkedHashMap<String, CatalogCategory> map = new java.util.LinkedHashMap<>();
        for (CatalogCategory cat : source) {
            if (cat == null || cat.id() == null || cat.id().isBlank()) {
                continue;
            }
            List<CatalogCategory> children = dedupeCategories(cat.children());
            String key = normalizeCategoryKey(cat);
            if (!map.containsKey(key)) {
                map.put(key, new CatalogCategory(cat.id(), cat.name(), children));
            }
        }
        return List.copyOf(map.values());
    }

    private List<CatalogGame> dedupeGames(List<CatalogGame> source) {
        if (source == null || source.isEmpty()) {
            return List.of();
        }
        java.util.LinkedHashMap<String, CatalogGame> map = new java.util.LinkedHashMap<>();
        for (CatalogGame game : source) {
            if (game == null || game.code() == null || game.code().isBlank()) {
                continue;
            }
            map.putIfAbsent(normalizeGameCode(game.code()), game);
        }
        return List.copyOf(map.values());
    }

    private List<String> dedupeCategoryNames(List<CatalogCategory> categories) {
        java.util.LinkedHashMap<String, String> map = new java.util.LinkedHashMap<>();
        for (CatalogCategory cat : categories) {
            if (cat == null) {
                continue;
            }
            String name = cat.name() == null ? "" : cat.name();
            String key = normalizeName(name);
            if (!map.containsKey(key)) {
                map.put(key, name);
            }
        }
        return List.copyOf(map.values());
    }

    private List<String> dedupeGameNames(List<CatalogGame> games) {
        java.util.LinkedHashMap<String, String> map = new java.util.LinkedHashMap<>();
        for (CatalogGame game : games) {
            if (game == null) {
                continue;
            }
            String name = game.name() == null ? "" : game.name();
            String key = normalizeName(name);
            if (!map.containsKey(key)) {
                map.put(key, name);
            }
        }
        return List.copyOf(map.values());
    }

    private String normalizeCategoryKey(CatalogCategory cat) {
        if (cat == null) {
            return "";
        }
        String id = cat.id();
        if (id != null && !id.isBlank()) {
            return id.trim().toLowerCase(java.util.Locale.ROOT);
        }
        String name = cat.name();
        return name == null ? "" : name.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private String normalizeGameCode(String code) {
        return code == null ? "" : code.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private String normalizeName(String value) {
        return value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private void withProgrammatic(Runnable action) {
        programmaticSelection = true;
        try {
            action.run();
        } finally {
            programmaticSelection = false;
        }
    }
}
