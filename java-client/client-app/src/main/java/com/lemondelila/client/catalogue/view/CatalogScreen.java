package com.lemondelila.client.catalogue.view;

import com.lemondelila.client.game.controller.GameCatalogController;
import com.lemondelila.client.game.controller.GameInteractionController;
import com.lemondelila.client.gamelogic.damenature.controller.DameNatureController;
import com.lemondelila.client.gamelogic.missionnemesis.controller.NemesisController;
import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressController;
import com.lemondelila.client.media.SoundBank;
import com.lemondelila.client.catalogue.model.CatalogCategory;
import com.lemondelila.client.catalogue.model.CatalogData;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenManager;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.DefaultListCellRenderer;
import javax.swing.DefaultListModel;
import javax.swing.JButton;
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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public final class CatalogScreen extends JPanel implements Screen {

    private static final String ROOT_CATEGORY = "__root__";
    private static final String ACTION_BACK = "catalog.back";

    private final GameCatalogController catalogController;
    private final DialogService dialogService;
    private final NemesisController missionController;
    private final DameNatureController dameNatureController;
    private final PanierExpressController panierExpressController;
    private final SoundEffectManager soundManager;

    private final CardLayout viewLayout = new CardLayout();
    private final JPanel viewPanel = new JPanel(viewLayout);
    private final CategoryListPanel categoryListPanel;
    private final GameListPanel gameListPanel;
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
    private final Set<String> pendingCategoryLoads = new HashSet<>();

    private GameSummary activeGame;
    private final GameInteractionController gameInteractionController;

    @Inject
    public CatalogScreen(GameCatalogController catalogController,
                         GameRulesService rulesService,
                         DialogService dialogService,
                         NemesisController missionController,
                         DameNatureController dameNatureController,
                         PanierExpressController panierExpressController,
                         SoundEffectManager soundManager) {
        this.catalogController = Objects.requireNonNull(catalogController, "catalogController");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.missionController = missionController;
        this.dameNatureController = dameNatureController;
        this.panierExpressController = Objects.requireNonNull(panierExpressController, "panierExpressController");
        this.soundManager = soundManager;
        this.categoryListPanel = new CategoryListPanel(soundManager);
        this.gameListPanel = new GameListPanel(soundManager);
        buildUi();
        installActions();
        gameDetailPanel.onPlay(this::handlePlayRequest);
        this.gameInteractionController = new GameInteractionController(
                gameDetailPanel,
                dialogService,
                rulesService,
                () -> Optional.ofNullable(activeGame),
                this::performBackNavigation,
                this::setStatus,
                null,
                null
        );
        gameInteractionController.setEnabled(false);
    }

    private void buildUi() {
        setLayout(new BorderLayout(16, 16));
        setBorder(BorderFactory.createEmptyBorder(32, 48, 32, 48));

        titleLabel.setFont(titleLabel.getFont().deriveFont(Font.BOLD, 26f));
        AccessibleDecorator.apply(titleLabel, AccessibleSpec.builder()
                .name("Catalogue des jeux")
                .description("Sélection de catégories et jeux disponibles")
                .build());
        breadcrumbLabel.setFont(breadcrumbLabel.getFont().deriveFont(Font.ITALIC, 14f));
        AccessibleDecorator.apply(breadcrumbLabel, AccessibleSpec.builder()
                .name("Fil d'Ariane catalogue")
                .description("Indique la catégorie ou le jeu en cours de consultation")
                .build());

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
        AccessibleDecorator.apply(statusLabel, AccessibleSpec.builder()
                .name("Statut catalogue")
                .description("Affiche l'état des chargements et actions sur le catalogue")
                .build());
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
        playSelectSound();
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
        playSelectSound();
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
        playNavigateSound();

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
        playNavigateSound();

        List<GameSummary> games = gamesByCategory.getOrDefault(state.categoryId, List.of());
        gameListPanel.show(games, state.selectedIndex);
        viewLayout.show(viewPanel, GameListPanel.CARD);
        SwingUtilities.invokeLater(gameListPanel::requestFocusInWindow);

        String label = categoryBreadcrumbs.getOrDefault(state.categoryId, "Categorie");
        breadcrumbLabel.setText("Jeux : " + label);
        if (games.isEmpty()) {
            setStatus("Aucun jeu repertorie dans " + label + ". Verification en cours...");
            requestGamesForCategory(state.categoryId, label, state);
        } else {
            setStatus(games.size() + " jeu(x) dans " + label + ".");
        }
    }

    private void showGame(ViewState state) {
        playNavigateSound();
        GameSummary game = gameIndex.get(state.gameCode);
        if (game == null) {
            gameInteractionController.setEnabled(false);
            setStatus("Jeu introuvable.");
            return;
        }
        boolean playable = supportsLaunch(game);
        gameDetailPanel.show(game, playable);
        viewLayout.show(viewPanel, GameDetailPanel.CARD);
        SwingUtilities.invokeLater(gameDetailPanel::requestFocusInWindow);
        activeGame = game;
        gameInteractionController.setEnabled(true);

        breadcrumbLabel.setText("Jeu : " + game.name());
        setStatus("Jeu pret. Ctrl+F1 pour voir les regles, Q pour quitter.");
    }

    private boolean supportsLaunch(GameSummary game) {
        if (game == null) {
            return false;
        }
        String identifier = game.engine();
        if (identifier == null || identifier.isBlank()) {
            identifier = game.code();
        }
        if (identifier == null) {
            return false;
        }
        if (identifier.equalsIgnoreCase("mission-nemesis")) {
            return missionController != null;
        }
        if (identifier.equalsIgnoreCase("dame-nature")) {
            return dameNatureController != null;
        }
        if (identifier.equalsIgnoreCase("panier-express")) {
            return panierExpressController != null;
        }
        return false;
    }

    private void handlePlayRequest(GameSummary game) {
        if (game == null) {
            return;
        }
        playSelectSound();
        if (!supportsLaunch(game)) {
            dialogService.info("Fonctionnalite indisponible",
                    "Ce jeu ne peut pas encore etre lance depuis cette interface.");
            return;
        }
        String identifier = game.engine();
        if (identifier == null || identifier.isBlank()) {
            identifier = game.code();
        }
        final boolean isPanierExpress = identifier != null && identifier.equalsIgnoreCase("panier-express");
        final String screenId = identifier != null ? identifier.toLowerCase() : null;
        if ("panier-express".equalsIgnoreCase(identifier)) {
            setStatus("Ouverture de Panier Express...");
            if (screenManager != null && screenId != null) {
                screenManager.show(screenId);
            }
            return;
        }

        CompletableFuture<?> launchFuture;
        if ("mission-nemesis".equalsIgnoreCase(identifier) && missionController != null) {
            launchFuture = missionController.startNewGame();
        } else if ("dame-nature".equalsIgnoreCase(identifier) && dameNatureController != null) {
            launchFuture = dameNatureController.startNewGame();
        } else {
            dialogService.info("Fonctionnalite indisponible",
                    "Ce jeu ne peut pas encore etre lance depuis cette interface.");
            return;
        }

        gameDetailPanel.setPlayEnabled(false);
        setStatus(isPanierExpress
                ? "Ouverture de Panier Express..."
                : "Initialisation de " + game.name() + "...");
        launchFuture.whenComplete((session, error) -> SwingUtilities.invokeLater(() -> {
            if (error != null) {
                String message = isPanierExpress
                        ? "La partie Panier Express n'a pas pu etre initialisee."
                        : "La partie " + game.name() + " n'a pas pu etre initialisee.";
                dialogService.error("Lancement impossible", message);
                setStatus(isPanierExpress
                        ? "Impossible d'initialiser Panier Express pour le moment."
                        : "Echec du lancement de " + game.name() + ".");
                gameDetailPanel.setPlayEnabled(true);
            } else {
                setStatus(isPanierExpress
                        ? "Panier Express est prêt. Bonne partie !"
                        : "Partie " + game.name() + " lancee.");
                gameDetailPanel.setPlayEnabled(true);
                if (screenManager != null && screenId != null) {
                    screenManager.show(screenId);
                }
            }
        }));
    }

    private void performBackNavigation() {
        playSelectSound();
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

    private void playSelectSound() {
        if (soundManager != null) {
            soundManager.play(SoundBank.MENU_SELECT);
        }
    }

    private void playNavigateSound() {
        if (soundManager != null) {
            soundManager.play(SoundBank.MENU_NAVIGATE);
        }
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

    private void requestGamesForCategory(String categoryId, String label, ViewState state) {
        if (categoryId == null || pendingCategoryLoads.contains(categoryId)) {
            return;
        }
        pendingCategoryLoads.add(categoryId);
        catalogController.loadGamesForCategory(categoryId).whenComplete((result, error) -> SwingUtilities.invokeLater(() -> {
            pendingCategoryLoads.remove(categoryId);
            if (error != null || result == null || result.isEmpty()) {
                setStatus("Aucun jeu disponible dans " + label + " pour le moment.");
                return;
            }
            registerRemoteGames(result);
            ViewState current = navigationStack.peek();
            if (current != null
                    && current.mode == ViewMode.GAMES
                    && Objects.equals(current.categoryId, categoryId)) {
                int maxIndex = Math.max(result.size() - 1, 0);
                current.selectedIndex = Math.max(0, Math.min(current.selectedIndex, maxIndex));
                showGames(current);
            }
        }));
    }

    private void registerRemoteGames(List<GameSummary> games) {
        if (games == null || games.isEmpty()) {
            return;
        }

        Map<String, List<GameSummary>> updatedGamesByCategory = new LinkedHashMap<>(gamesByCategory);
        Map<String, GameSummary> updatedGameIndex = new LinkedHashMap<>(gameIndex);

        for (GameSummary game : games) {
            updatedGameIndex.put(game.code(), game);
            for (String categoryId : game.categories()) {
                List<GameSummary> existing = updatedGamesByCategory.get(categoryId);
                List<GameSummary> modifiable = existing == null ? new ArrayList<>() : new ArrayList<>(existing);
                boolean alreadyPresent = modifiable.stream()
                        .anyMatch(existingGame -> existingGame.code().equals(game.code()));
                if (!alreadyPresent) {
                    modifiable.add(game);
                    modifiable.sort((a, b) -> String.CASE_INSENSITIVE_ORDER.compare(a.name(), b.name()));
                }
                updatedGamesByCategory.put(categoryId, List.copyOf(modifiable));
            }
        }

        gamesByCategory = Map.copyOf(updatedGamesByCategory);
        gameIndex = Map.copyOf(updatedGameIndex);
    }

    private static final class CategoryListPanel extends JPanel {

        static final String CARD = "categories";

        private final DefaultListModel<CategoryItem> model = new DefaultListModel<>();
        private final JList<CategoryItem> list = new JList<>(model);
        private final SoundEffectManager soundManager;

        CategoryListPanel(SoundEffectManager soundManager) {
            this.soundManager = soundManager;
            setLayout(new BorderLayout());
            setOpaque(false);
            list.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
            list.setVisibleRowCount(-1);
            list.setFocusTraversalKeysEnabled(false);
            list.setCellRenderer(new CategoryItemRenderer());
            AccessibleDecorator.apply(list, AccessibleSpec.builder()
                    .name("Liste des catégories")
                    .description("Sélectionnez une catégorie et validez avec Entrée pour afficher son contenu")
                    .build());
            list.addListSelectionListener(event -> {
                if (!event.getValueIsAdjusting() && list.isFocusOwner() && this.soundManager != null) {
                    this.soundManager.play(SoundBank.MENU_NAVIGATE);
                }
            });
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
                    if (soundManager != null) {
                        soundManager.play(SoundBank.MENU_SELECT);
                    }
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
        private final SoundEffectManager soundManager;

        GameListPanel(SoundEffectManager soundManager) {
            this.soundManager = soundManager;
            setLayout(new BorderLayout());
            setOpaque(false);
            list.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
            list.setVisibleRowCount(-1);
            list.setFocusTraversalKeysEnabled(false);
            list.setCellRenderer(new GameSummaryRenderer());
            AccessibleDecorator.apply(list, AccessibleSpec.builder()
                    .name("Liste des jeux")
                    .description("Choisissez un jeu et validez avec Entrée pour consulter sa fiche")
                    .build());
            list.addListSelectionListener(event -> {
                if (!event.getValueIsAdjusting() && list.isFocusOwner() && this.soundManager != null) {
                    this.soundManager.play(SoundBank.MENU_NAVIGATE);
                }
            });
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
                    if (soundManager != null) {
                        soundManager.play(SoundBank.MENU_SELECT);
                    }
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
        private final JButton playButton = new JButton("Jouer");

        private Consumer<GameSummary> playListener;
        private GameSummary currentGame;

        GameDetailPanel() {
            setLayout(new BorderLayout());
            setOpaque(false);
            setFocusable(true);

            nameLabel.setFont(nameLabel.getFont().deriveFont(Font.BOLD, 22f));
            AccessibleDecorator.apply(nameLabel, AccessibleSpec.builder()
                    .name("Nom du jeu sélectionné")
                    .description("Indication du jeu actuellement consulté")
                    .build());
            summaryArea.setEditable(false);
            summaryArea.setLineWrap(true);
            summaryArea.setWrapStyleWord(true);
            summaryArea.setFocusable(false);
            summaryArea.setOpaque(false);
            AccessibleDecorator.apply(summaryArea, AccessibleSpec.builder()
                    .name("Description du jeu")
                    .description("Texte descriptif et résumé du jeu choisi")
                    .build());

            JScrollPane summaryScroll = new JScrollPane(summaryArea);
            summaryScroll.setBorder(BorderFactory.createTitledBorder("Description"));
            summaryScroll.setOpaque(false);
            summaryScroll.getViewport().setOpaque(false);
            summaryScroll.setPreferredSize(new Dimension(0, 200));

            playButton.setAlignmentX(CENTER_ALIGNMENT);
            playButton.setVisible(false);
            AccessibleDecorator.apply(playButton, AccessibleSpec.builder()
                    .name("Lancer le jeu")
                    .description("Démarre ou ouvre l'expérience du jeu sélectionné")
                    .build());
            playButton.addActionListener(e -> {
                if (playListener != null && currentGame != null) {
                    playListener.accept(currentGame);
                }
            });

            JPanel content = new JPanel();
            content.setLayout(new BoxLayout(content, BoxLayout.Y_AXIS));
            content.setOpaque(false);
            content.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));
            content.add(nameLabel);
            content.add(Box.createRigidArea(new Dimension(0, 12)));
            content.add(summaryScroll);
            content.add(Box.createRigidArea(new Dimension(0, 12)));
            content.add(playButton);

            add(content, BorderLayout.CENTER);
        }

        void onPlay(Consumer<GameSummary> listener) {
            this.playListener = listener;
        }

        void show(GameSummary game, boolean playable) {
            currentGame = game;
            nameLabel.setText(game.name());
            String summary = game.summary();
            if (summary == null || summary.isBlank()) {
                summaryArea.setText("Aucune description n'est disponible pour ce jeu.");
            } else {
                summaryArea.setText(summary);
            }
            summaryArea.setCaretPosition(0);
            summaryArea.getAccessibleContext().setAccessibleDescription(summaryArea.getText());
            String playLabel = "Jouer";
            String engine = game.engine() != null ? game.engine() : game.code();
            if (engine != null && engine.equalsIgnoreCase("panier-express")) {
                playLabel = "Configurer la partie";
            }
            playButton.setText(playLabel);
            if (playButton.getAccessibleContext() != null) {
                playButton.getAccessibleContext().setAccessibleName(playLabel);
            }
            playButton.setVisible(playable);
            playButton.setEnabled(playable);
        }

        void setPlayEnabled(boolean enabled) {
            if (playButton.isVisible()) {
                playButton.setEnabled(enabled);
            }
        }

        @Override
        public void setEnabled(boolean enabled) {
            super.setEnabled(enabled);
            summaryArea.setEnabled(enabled);
            if (playButton.isVisible()) {
                playButton.setEnabled(enabled);
            }
        }
    }
}




