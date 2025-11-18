package com.lemondelila.client.catalogue.presenter;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.controller.GameCatalogController;
import com.lemondelila.client.game.launcher.GameLauncher;
import com.lemondelila.client.game.launcher.GameLauncherRegistry;

import javax.swing.SwingUtilities;
import java.util.Objects;
import java.util.Optional;

public final class CatalogPresenter {

    public interface View {
        void setLoadingState(boolean busy);
        void setStatus(String text);
        void navigateTo(ScreenId id);
        void onGameSelection(GameSummary summary);
        void setGameActionsEnabled(boolean enabled);
        void playSelectSound();
        void showMainMenu();
    }

    private final DialogService dialogService;
    private final GameLauncherRegistry launcherRegistry;
    private final CatalogDataIndex dataIndex = new CatalogDataIndex();
    private final CatalogDataLoader dataLoader;

    private CatalogNavigationController navigation;
    private CatalogViewPort contentView;
    private View view;
    private ScreenManager screenManager;

    @Inject
    public CatalogPresenter(DialogService dialogService,
                            GameLauncherRegistry launcherRegistry,
                            GameCatalogController catalogController) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.launcherRegistry = Objects.requireNonNull(launcherRegistry, "launcherRegistry");
        this.dataLoader = new CatalogDataLoader(
                Objects.requireNonNull(catalogController, "catalogController"),
                dataIndex);
    }

    public void bind(View view, CatalogViewPort contentView) {
        this.view = Objects.requireNonNull(view, "view");
        this.contentView = Objects.requireNonNull(contentView, "contentView");
        this.navigation = new CatalogNavigationController(
                dataIndex,
                contentView,
                dataLoader,
                this::handleSelection);
    }

    public void unbind() {
        this.view = null;
        this.contentView = null;
        this.navigation = null;
        this.screenManager = null;
    }

    public void onShow(ScreenManager manager) {
        this.screenManager = manager;
        ensureCatalogReady(false);
    }

    public void onHide() {
        this.screenManager = null;
        if (view != null) {
            view.setGameActionsEnabled(false);
        }
    }

    public void refresh(boolean forceReload) {
        ensureCatalogReady(forceReload);
    }

    private void handleSelection(GameSummary selection) {
        if (view == null) {
            return;
        }
        view.onGameSelection(selection);
        view.setGameActionsEnabled(selection != null);
    }

    public void onGameSelectionChanged(GameSummary selection, int index) {
        if (navigation != null) {
            navigation.updateGameSelectionIndex(index);
        }
        handleSelection(selection);
    }

    public void onCategoryActivated(String categoryId, int categoryIndex) {
        if (categoryId == null || categoryId.isBlank()) {
            return;
        }
        if (view != null) {
            view.playSelectSound();
        }
        if (navigation != null) {
            navigation.openCategory(categoryId, categoryIndex);
        }
    }

    public void onGameActivated(GameSummary game) {
        if (game == null) {
            return;
        }
        if (view != null) {
            view.playSelectSound();
        }
        handlePlayRequest(game);
    }

    public void onNavigateBack() {
        if (view != null) {
            view.playSelectSound();
        }
        if (navigation == null || !navigation.navigateBack()) {
            if (view != null) {
                view.showMainMenu();
            }
        }
    }

    public void handlePlayRequest(GameSummary game) {
        if (game == null) {
            return;
        }
        Optional<GameLauncher> launcher = launcherRegistry.find(game);
        if (launcher.isEmpty()) {
            dialogService.info(
                    Internationalization.text("catalog.presenter.feature.title"),
                    Internationalization.text("catalog.presenter.feature.body"));
            return;
        }
        if (view != null) {
            view.setStatus(Internationalization.text("catalog.presenter.launch.start", game.name()));
        }
        launcher.get().launch(game).whenComplete((result, error) -> SwingUtilities.invokeLater(() -> {
            if (error != null) {
                dialogService.error(Internationalization.text("catalog.presenter.launch.error.title"), describeError(error));
                if (view != null) {
                    view.setStatus(Internationalization.text("catalog.presenter.launch.error.status", game.name()));
                }
                return;
            }
            applyLaunchResult(result);
        }));
    }

    private void ensureCatalogReady(boolean forceReload) {
        if (view == null || navigation == null) {
            return;
        }
        view.setStatus(Internationalization.text("catalog.presenter.load.start"));
        view.setLoadingState(true);
        dataLoader.loadCatalog(forceReload).whenComplete((changed, error) -> SwingUtilities.invokeLater(() -> {
            view.setLoadingState(false);
            if (error != null) {
                dialogService.error(
                        Internationalization.text("catalog.presenter.load.error.title"),
                        Internationalization.text("catalog.presenter.load.error.body"));
                view.setStatus(Internationalization.text("catalog.presenter.load.error.status"));
                return;
            }
            if (!navigation.hasState() || Boolean.TRUE.equals(changed)) {
                navigation.showRoot();
            } else {
                navigation.refreshCurrent();
            }
        }));
    }

    private void applyLaunchResult(ControllerResult result) {
        if (result == null) {
            return;
        }
        if (view != null) {
            result.statusMessage().ifPresent(view::setStatus);
        }
        result.navigationTarget().ifPresent(this::navigate);
    }

    private void navigate(ScreenId id) {
        if (id == null) {
            return;
        }
        if (screenManager != null) {
            screenManager.show(id);
        } else if (view != null) {
            view.navigateTo(id);
        }
    }

    private String describeError(Throwable error) {
        if (error == null) {
            return Internationalization.text("catalog.presenter.error.unknown");
        }
        Throwable cause = error;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }
        String message = cause.getMessage();
        return (message == null || message.isBlank()) ? cause.toString() : message;
    }
}
