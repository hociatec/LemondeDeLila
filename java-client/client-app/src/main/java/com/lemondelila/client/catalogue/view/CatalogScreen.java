package com.lemondelila.client.catalogue.view;

import com.lemondelila.client.application.view.menu.MainMenuScreen;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.presenter.CatalogPresenter;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.catalogue.view.CatalogViewFactory;
import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.access.shortcut.ShortcutBinder;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.controller.GameActionState;
import com.lemondelila.client.game.controller.GameQuitController;
import com.lemondelila.client.game.controller.GameRulesController;

import javax.swing.JPanel;
import java.util.Objects;
import java.util.Optional;
public final class CatalogScreen extends JPanel implements Screen, CatalogPresenter.View {
    public static final ScreenId ID = ScreenId.of("catalog");
    private static final String ACTION_BACK = "catalog.back";

    private final DialogService dialogService;

    private final CatalogViewCoordinator view;
    private final CategoryListPanel categoryListPanel;
    private final GameListPanel gameListPanel;
    private final GameActionState gameActionState = new GameActionState();
    private final NarrationQueue narrationQueue;
    private final GameQuitController quitController;
    private final GameRulesController rulesController;
    private final AccessibleShortcutRegistry shortcutRegistry;
    private final ShortcutBinder shortcutBinder;
    private AutoCloseable shortcutScope;
    private AutoCloseable shortcutAttachment;

    private ScreenManager screenManager;
    private GameSummary activeGame;
    private AutoCloseable dialogBinding;
    private final CatalogPresenter presenter;

    @Inject
    public CatalogScreen(CatalogPresenter presenter,
                         GameRulesService rulesService,
                         DialogService dialogService,
                         CatalogViewFactory viewFactory,
                         AccessibleShortcutRegistry shortcutRegistry,
                         NarrationQueue narrationQueue) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.presenter = Objects.requireNonNull(presenter, "presenter");
        this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
        this.narrationQueue = narrationQueue;
        this.view = viewFactory.create(this);
        this.categoryListPanel = view.categoryListPanel();
        this.gameListPanel = view.gameListPanel();
        this.presenter.bind(this, view);
        installActions();
        this.gameListPanel.onSelectionChange(selection ->
                presenter.onGameSelectionChanged(selection, gameListPanel.selectedIndex()));
        this.shortcutBinder = new ShortcutBinder(shortcutRegistry, gameActionState::isEnabled, this);
        this.quitController = new GameQuitController(
                this,
                dialogService,
                this::currentGame,
                presenter::onNavigateBack,
                this::setStatus,
                shortcutBinder
        );
        this.rulesController = new GameRulesController(
                this,
                dialogService,
                rulesService,
                this::currentGame,
                this::setStatus,
                gameActionState::isEnabled,
                shortcutBinder
        );
        gameActionState.onDisabled(rulesController::clearLoading);
    }

    private void installActions() {
        categoryListPanel.onEnter(() -> {
            CategoryListPanel.CategoryItem item = categoryListPanel.selectedItem();
            presenter.onCategoryActivated(item != null ? item.id() : null, categoryListPanel.selectedIndex());
        });
        gameListPanel.onEnter(() -> presenter.onGameActivated(gameListPanel.selectedItem()));
        Runnable backAction = presenter::onNavigateBack;
        categoryListPanel.onEscape(backAction);
        gameListPanel.onEscape(backAction);
    }

    private void showScreen(ScreenId id) {
        if (screenManager != null && id != null) {
            screenManager.show(id);
        }
    }

    private void updateActiveGame(GameSummary selection) {
        this.activeGame = selection;
        gameActionState.setEnabled(selection != null);
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
        bindDialogService();
        applyShortcutScope();
        presenter.onShow(screenManager);
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        gameActionState.setEnabled(false);
        activeGame = null;
        resetShortcutScope();
        releaseDialogBinding();
        presenter.onHide();
    }

    private void bindDialogService() {
        releaseDialogBinding();
        dialogBinding = dialogService.attach(this);
    }

    private void releaseDialogBinding() {
        if (dialogBinding == null) {
            return;
        }
        try {
            dialogBinding.close();
        } catch (Exception ignored) {
        } finally {
            dialogBinding = null;
        }
    }

    @Override
    public void setLoadingState(boolean busy) {
        view.setLoadingState(busy);
    }

    @Override
    public void setStatus(String text) {
        view.setStatus(text);
    }

    @Override
    public void navigateTo(ScreenId id) {
        showScreen(id);
    }

    @Override
    public void onGameSelection(GameSummary summary) {
        updateActiveGame(summary);
    }

    @Override
    public void setGameActionsEnabled(boolean enabled) {
        gameActionState.setEnabled(enabled);
    }

    @Override
    public void playSelectSound() {
        view.playSelectSound();
    }

    @Override
    public void showMainMenu() {
        if (screenManager != null) {
            screenManager.show(MainMenuScreen.ID);
        }
    }

    private Optional<GameSummary> currentGame() {
        return Optional.ofNullable(activeGame);
    }

    private void applyShortcutScope() {
        if (shortcutRegistry == null || shortcutBinder == null) {
            return;
        }
        resetShortcutScope();
        shortcutScope = shortcutRegistry.openScope();
        registerGlobalShortcuts();
        shortcutAttachment = shortcutRegistry.applyTo(this);
    }

    private void registerGlobalShortcuts() {
        shortcutBinder.registerStroke("ESCAPE",
                ACTION_BACK,
                "Échap : revenir à l'écran précédent.",
                e -> presenter.onNavigateBack(),
                () -> true);
    }

    private void resetShortcutScope() {
        closeQuietly(shortcutAttachment);
        shortcutAttachment = null;
        closeQuietly(shortcutScope);
        shortcutScope = null;
    }

    private static void closeQuietly(AutoCloseable closeable) {
        if (closeable == null) {
            return;
        }
        try {
            closeable.close();
        } catch (Exception ignored) {
        }
    }
}
