package com.lemondelila.client.catalogue.view;

import com.lemondelila.client.application.view.menu.MainMenuScreen;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;
import com.lemondelila.client.game.controller.GameCatalogController;
import com.lemondelila.client.game.controller.GameInteractionController;
import com.lemondelila.client.game.launcher.GameLauncher;
import com.lemondelila.client.game.launcher.GameLauncherRegistry;

import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.event.ActionEvent;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

public final class CatalogScreen extends JPanel implements Screen {
    public static final ScreenId ID = ScreenId.of("catalog");
    private static final String ACTION_BACK = "catalog.back";

    private final DialogService dialogService;
    private final GameLauncherRegistry launcherRegistry;

    private final CatalogViewCoordinator view;
    private final CategoryListPanel categoryListPanel;
    private final GameListPanel gameListPanel;
    private final CatalogDataIndex dataIndex = new CatalogDataIndex();
    private final CatalogDataLoader dataLoader;
    private final CatalogNavigationController navigation;

    private final GameInteractionController gameInteractionController;
    private ScreenManager screenManager;
    private GameSummary activeGame;

    @Inject
    public CatalogScreen(GameCatalogController catalogController,
                         GameRulesService rulesService,
                         DialogService dialogService,
                         GameLauncherRegistry launcherRegistry,
                         SoundEffectManager soundManager) {
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.launcherRegistry = Objects.requireNonNull(launcherRegistry, "launcherRegistry");
        this.view = new CatalogViewCoordinator(this, soundManager);
        this.categoryListPanel = view.categoryListPanel();
        this.gameListPanel = view.gameListPanel();
        this.dataLoader = new CatalogDataLoader(catalogController, dataIndex);
        this.navigation = new CatalogNavigationController(
                dataIndex,
                view,
                dataLoader,
                view::playNavigateSound,
                selection -> {
                    if (selection == null) {
                        updateActiveGame(null);
                    }
                }
        );
        installActions();
        this.gameListPanel.onSelectionChange(selection -> {
            navigation.updateGameSelectionIndex(gameListPanel.selectedIndex());
            updateActiveGame(selection);
        });
        this.gameInteractionController = new GameInteractionController(
                this,
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

    private void installActions() {
        categoryListPanel.onEnter(() -> {
            CategoryListPanel.CategoryItem item = categoryListPanel.selectedItem();
            if (item == null) {
                return;
            }
            playSelectSound();
            navigation.openCategory(item.id(), categoryListPanel.selectedIndex());
        });
        gameListPanel.onEnter(this::openSelectedGame);

        getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("ESCAPE"), ACTION_BACK);
        getActionMap().put(ACTION_BACK, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                performBackNavigation();
            }
        });
    }

    private void openSelectedGame() {
        GameSummary game = gameListPanel.selectedItem();
        if (game == null) {
            return;
        }
        playSelectSound();
        handlePlayRequest(game);
    }

    private void handlePlayRequest(GameSummary game) {
        if (game == null) {
            return;
        }
        playSelectSound();
        Optional<GameLauncher> launcher = launcherRegistry.find(game);
        if (launcher.isEmpty()) {
            dialogService.info("Fonctionnalite indisponible",
                    "Ce jeu ne peut pas encore etre lance depuis cette interface.");
            return;
        }
        setStatus("Initialisation de " + game.name() + "...");
        launcher.get().launch(game).whenComplete((result, error) -> SwingUtilities.invokeLater(() -> {
            if (error != null) {
                dialogService.error("Lancement impossible", describeError(error));
                setStatus("Echec du lancement de " + game.name() + ".");
                return;
            }
            applyLaunchResult(result);
        }));
    }

    private void applyLaunchResult(ControllerResult result) {
        if (result == null) {
            return;
        }
        result.statusMessage().ifPresent(this::setStatus);
        result.navigationTarget().ifPresent(this::showScreen);
    }

    private void showScreen(ScreenId id) {
        if (screenManager != null && id != null) {
            screenManager.show(id);
        }
    }

    private void performBackNavigation() {
        playSelectSound();
        if (!navigation.navigateBack() && screenManager != null) {
            screenManager.show(MainMenuScreen.ID);
        }
    }

    private void ensureCatalogReady(boolean forceReload) {
        setStatus("Chargement du catalogue...");
        setLoadingState(true);
        dataLoader.loadCatalog(forceReload).whenComplete((changed, error) ->
                SwingUtilities.invokeLater(() -> {
                    setLoadingState(false);
                    if (error != null) {
                        dialogService.error("Catalogue indisponible",
                                "Impossible de charger le catalogue pour le moment.");
                        setStatus("Erreur lors du chargement du catalogue.");
                        return;
                    }
                    if (!navigation.hasState() || Boolean.TRUE.equals(changed)) {
                        navigation.showRoot();
                    } else {
                        navigation.refreshCurrent();
                    }
                }));
    }

    private void setLoadingState(boolean busy) {
        view.setLoadingState(busy);
    }

    private void setStatus(String text) {
        view.setStatus(text);
    }

    private void playSelectSound() {
        view.playSelectSound();
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

    private void updateActiveGame(GameSummary selection) {
        this.activeGame = selection;
        gameInteractionController.setEnabled(selection != null);
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
        dialogService.attach(this);
        ensureCatalogReady(false);
    }

    @Override
    public void onHide(ScreenContext context) {
        this.screenManager = null;
        gameInteractionController.setEnabled(false);
        activeGame = null;
    }
}
