package com.lemondelila.client.catalogue.presenter;

import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.view.CatalogDataLoader;
import com.lemondelila.client.catalogue.view.CatalogNavigationController;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.launcher.GameLauncher;
import com.lemondelila.client.game.launcher.GameLauncherRegistry;

import javax.swing.SwingUtilities;
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
    private final CatalogDataLoader dataLoader;
    private final CatalogNavigationController navigation;
    private final View view;
    private ScreenManager screenManager;

    public CatalogPresenter(DialogService dialogService,
                            GameLauncherRegistry launcherRegistry,
                            CatalogDataLoader dataLoader,
                            CatalogNavigationController navigation,
                            View view) {
        this.dialogService = dialogService;
        this.launcherRegistry = launcherRegistry;
        this.dataLoader = dataLoader;
        this.navigation = navigation;
        this.view = view;
    }

    public void onShow(ScreenManager manager) {
        this.screenManager = manager;
        ensureCatalogReady(false);
    }

    public void onHide() {
        this.screenManager = null;
        view.setGameActionsEnabled(false);
    }

    public void refresh(boolean forceReload) {
        ensureCatalogReady(forceReload);
    }

    public void handleSelection(GameSummary selection) {
        view.onGameSelection(selection);
        view.setGameActionsEnabled(selection != null);
    }

    public void onGameSelectionChanged(GameSummary selection, int index) {
        navigation.updateGameSelectionIndex(index);
        handleSelection(selection);
    }

    public void onCategoryActivated(String categoryId, int categoryIndex) {
        if (categoryId == null || categoryId.isBlank()) {
            return;
        }
        view.playSelectSound();
        navigation.openCategory(categoryId, categoryIndex);
    }

    public void onGameActivated(GameSummary game) {
        if (game == null) {
            return;
        }
        view.playSelectSound();
        handlePlayRequest(game);
    }

    public void onNavigateBack() {
        view.playSelectSound();
        if (!navigation.navigateBack()) {
            view.showMainMenu();
        }
    }

    public void handlePlayRequest(GameSummary game) {
        if (game == null) {
            return;
        }
        Optional<GameLauncher> launcher = launcherRegistry.find(game);
        if (launcher.isEmpty()) {
            dialogService.info("Fonctionnalite indisponible",
                    "Ce jeu ne peut pas encore etre lance depuis cette interface.");
            return;
        }
        view.setStatus("Initialisation de " + game.name() + "...");
        launcher.get().launch(game).whenComplete((result, error) -> SwingUtilities.invokeLater(() -> {
            if (error != null) {
                dialogService.error("Lancement impossible", describeError(error));
                view.setStatus("Echec du lancement de " + game.name() + ".");
                return;
            }
            applyLaunchResult(result);
        }));
    }

    private void ensureCatalogReady(boolean forceReload) {
        view.setStatus("Chargement du catalogue...");
        view.setLoadingState(true);
        dataLoader.loadCatalog(forceReload).whenComplete((changed, error) -> SwingUtilities.invokeLater(() -> {
            view.setLoadingState(false);
            if (error != null) {
                dialogService.error("Catalogue indisponible",
                        "Impossible de charger le catalogue pour le moment.");
                view.setStatus("Erreur lors du chargement du catalogue.");
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
        result.statusMessage().ifPresent(view::setStatus);
        result.navigationTarget().ifPresent(this::navigate);
    }

    private void navigate(ScreenId id) {
        if (id == null) {
            return;
        }
        if (screenManager != null) {
            screenManager.show(id);
        } else {
            view.navigateTo(id);
        }
    }

    private String describeError(Throwable error) {
        if (error == null) {
            return "Erreur inconnue";
        }
        Throwable cause = error;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }
        String message = cause.getMessage();
        return (message == null || message.isBlank()) ? cause.toString() : message;
    }
}
