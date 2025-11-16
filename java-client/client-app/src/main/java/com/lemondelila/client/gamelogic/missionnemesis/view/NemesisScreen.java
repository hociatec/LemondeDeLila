package com.lemondelila.client.gamelogic.missionnemesis.view;

import com.lemondelila.client.game.controller.GameActionState;
import com.lemondelila.client.game.controller.GameBotController;
import com.lemondelila.client.game.controller.GameQuitController;
import com.lemondelila.client.game.controller.GameRulesController;
import com.lemondelila.client.game.controller.GameTableInfoController;
import com.lemondelila.client.gamelogic.missionnemesis.controller.NemesisController;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.view.CatalogScreen;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.framework.access.game.AccessibilityService;
import com.lemondelila.client.framework.access.game.GameHistorySidebar;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.access.shortcut.ShortcutBinder;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.game.view.AbstractGameScreen;
import com.lemondelila.client.gamelogic.missionnemesis.presenter.NemesisGamePresenter;
import com.lemondelila.client.gamelogic.missionnemesis.presenter.NemesisGameInteractor;
import com.lemondelila.client.gamelogic.missionnemesis.presenter.NemesisSessionPresenter;

import javax.swing.BorderFactory;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.GridLayout;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public final class NemesisScreen extends AbstractGameScreen {

    public static final ScreenId ID = ScreenId.of("mission-nemesis");

    private enum ViewState {
        SETUP,
        MANUAL_PLACEMENT,
        ACTIVE_GAME
    }

    private static final GameSummary GAME_SUMMARY = new GameSummary(
            "mission-nemesis",
            "Mission Nemesis",
            1,
            2,
            "missionnemesis",
            "Affrontez un adversaire dans une bataille spatiale tactique.",
            true,
            List.of("jeux-de-plateau")
    );

    private final NemesisController controller;
    private final AccessibilityService accessibilityService;
    private final AccessibleShortcutRegistry shortcutRegistry;
    private final DialogService dialogService;
    private final ShortcutBinder shortcutBinder;
    private final GameActionState gameActionState;
    private final GameQuitController quitController;
    private final GameRulesController rulesController;
    private final GameBotController botController;
    private final GameTableInfoController tableInfoController;
    private AutoCloseable shortcutScope;
    private AutoCloseable shortcutAttachment;
    private final NemesisGameInteractor gameInteractor;

    private final NemesisSetupPanel setupPanel;
    private final NemesisPlacementPanel placementPanel = new NemesisPlacementPanel();
    private final GameHistorySidebar historySidebar = new GameHistorySidebar(
            "Journal des actions",
            "Historique des actions",
            "Derniers évènements de la partie Mission Nemesis."
    );
    private final NemesisFooterPanel footerPanel;
    private final NemesisGridPanel ownGrid;
    private final NemesisGridPanel enemyGrid;
    private final CardLayout mainLayout = new CardLayout();
    private final JPanel mainPanel = new JPanel(mainLayout);
    private final NemesisSessionPresenter sessionPresenter;
    private final NemesisGamePresenter gamePresenter;
    private final Consumer<NemesisSession> sessionListener;
    private AutoCloseable dialogBinding;

    @Inject
    public NemesisScreen(NemesisController controller,
                         NemesisSessionStore sessionStore,
                         AccessibilityService accessibilityService,
                         AccessibleShortcutRegistry shortcutRegistry,
                         DialogService dialogService,
                         GameRulesService rulesService) {
        super(ID, null);
        this.controller = Objects.requireNonNull(controller, "controller");
        this.accessibilityService = Objects.requireNonNull(accessibilityService, "accessibilityService");
        this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        Objects.requireNonNull(sessionStore, "sessionStore");
        this.ownGrid = new NemesisGridPanel(true, coordinate -> {});
        this.enemyGrid = new NemesisGridPanel(false, coordinate -> {});
        this.setupPanel = new NemesisSetupPanel(this::handleStartRequested);
        this.footerPanel = new NemesisFooterPanel(accessibilityService);
        this.sessionPresenter = new NemesisSessionPresenter(
                ownGrid,
                enemyGrid,
                historySidebar,
                footerPanel,
                this::setStatus
        );
        this.gamePresenter = new NemesisGamePresenter(
                controller,
                placementPanel,
                ownGrid,
                enemyGrid,
                historySidebar,
                sessionPresenter,
                this::setStatus,
                new NemesisGamePresenter.ViewCallbacks() {
                    @Override
                    public void showSetupView() {
                        mainLayout.show(mainPanel, ViewState.SETUP.name());
                    }

                    @Override
                    public void showBattleView() {
                        mainLayout.show(mainPanel, ViewState.ACTIVE_GAME.name());
                    }
                }
        );
        this.enemyGrid.setFireHandler(gamePresenter::fireAt);
        this.sessionListener = gamePresenter::handleSessionUpdate;
        this.gameActionState = ensureGameActionState();
        this.shortcutBinder = new ShortcutBinder(shortcutRegistry, gameActionState.guard(), this);
        this.gameInteractor = new NemesisGameInteractor(
                controller,
                gamePresenter::currentSession,
                this::setStatus
        );
        this.quitController = new GameQuitController(
                this,
                dialogService,
                () -> Optional.of(GAME_SUMMARY),
                this::exitToCatalog,
                this::setStatus,
                shortcutBinder
        );
        this.rulesController = new GameRulesController(
                this,
                dialogService,
                Objects.requireNonNull(rulesService, "rulesService"),
                () -> Optional.of(GAME_SUMMARY),
                this::setStatus,
                gameActionState.guard(),
                shortcutBinder
        );
        this.botController = new GameBotController(
                this,
                this::setStatus,
                gameActionState.guard(),
                this::addBotCommand,
                this::removeBotCommand,
                shortcutBinder
        );
        this.tableInfoController = new GameTableInfoController(
                this,
                this::setStatus,
                gameActionState.guard(),
                this::announceTableParticipants,
                this::announceCurrentTurn,
                shortcutBinder
        );
        gameActionState.onDisabled(rulesController::clearLoading);
        if (botController != null) {
            gameActionState.onDisabled(botController::resetAction);
        }

        buildUi();
    }

    private void buildUi() {
        setLayout(new BorderLayout(16, 16));
        setBorder(BorderFactory.createEmptyBorder(24, 32, 24, 32));
        setFocusTraversalKeysEnabled(false);

        add(new NemesisHeaderPanel(), BorderLayout.NORTH);

        JPanel gridsContainer = new JPanel(new GridLayout(1, 2, 16, 16));
        gridsContainer.add(ownGrid);
        gridsContainer.add(enemyGrid);

        JPanel setupContainer = new JPanel(new BorderLayout());
        setupContainer.add(setupPanel, BorderLayout.CENTER);

        JPanel battleContainer = new JPanel(new BorderLayout(12, 12));
        battleContainer.add(placementPanel, BorderLayout.NORTH);
        battleContainer.add(gridsContainer, BorderLayout.CENTER);
        historySidebar.setPreferredSize(new java.awt.Dimension(0, 180));
        battleContainer.add(historySidebar, BorderLayout.SOUTH);

        mainPanel.add(setupContainer, ViewState.SETUP.name());
        mainPanel.add(battleContainer, ViewState.ACTIVE_GAME.name());

        add(mainPanel, BorderLayout.CENTER);
        add(footerPanel, BorderLayout.SOUTH);

        showSetup();
    }

    private void configureKeyMap() {
        resetShortcutScopes();
        shortcutScope = shortcutRegistry.openScope();
        shortcutBinder.registerStroke("ESCAPE", "nemesis-esc-disabled", "Echap : aucune action durant la partie.", e -> setStatus("Echap est desactive pendant la partie. Utilisez Q pour quitter."));

        shortcutBinder.registerStroke("F5", "nemesis-refresh", "F5 : rafraichir l'etat de la partie.", e -> gameInteractor.refreshGame());
        shortcutAttachment = shortcutRegistry.applyTo(this);
    }

    private void resetShortcutScopes() {
        closeQuietly(shortcutAttachment);
        shortcutAttachment = null;
        closeQuietly(shortcutScope);
        shortcutScope = null;
    }

    private CompletableFuture<Void> addBotCommand() {
        return gameInteractor.addBot();
    }

    private CompletableFuture<Void> removeBotCommand() {
        return gameInteractor.removeBot();
    }

    private void handleStartRequested(NemesisSetupPanel.Configuration configuration) {
        gamePresenter.startGame(configuration);
    }

    private void showSetup() {
        gamePresenter.resetToSetup();
        SwingUtilities.invokeLater(setupPanel::activate);
    }

    @Override
    protected void setStatusMessage(String text) {
        footerPanel.showStatus(text);
        accessibilityService.announceCustom(footerPanel, text);
    }

    private void setStatus(String text) {
        setStatusMessage(text);
    }

    private void announceCurrentTurn() {
        gamePresenter.currentSession()
                .map(NemesisSession::state)
                .ifPresentOrElse(
                        state -> setStatus(sessionPresenter.describeCurrentTurn(state)),
                        () -> setStatus("Aucune partie active.")
                );
    }

    private void announceTableParticipants() {
        gamePresenter.currentSession()
                .ifPresentOrElse(
                        session -> setStatus(sessionPresenter.describeParticipants(session)),
                        () -> setStatus("Aucune partie active.")
                );
    }

    private void exitToCatalog() {
        gamePresenter.resetToSetup();
        navigate(CatalogScreen.ID);
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
        super.onShow(context);
        controller.addListener(sessionListener);
        bindDialogService();
        configureKeyMap();
        showSetup();
    }

    @Override
    public void onHide(ScreenContext context) {
        super.onHide(context);
        controller.removeListener(sessionListener);
        resetShortcutScopes();
        releaseDialogBinding();
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
