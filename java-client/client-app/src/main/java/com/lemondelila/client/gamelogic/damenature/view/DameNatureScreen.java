package com.lemondelila.client.gamelogic.damenature.view;

import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.view.CatalogScreen;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.framework.access.game.AccessibilityService;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.access.shortcut.ShortcutBinder;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.game.controller.GameActionState;
import com.lemondelila.client.game.controller.GameBotController;
import com.lemondelila.client.game.controller.GameQuitController;
import com.lemondelila.client.game.controller.GameRulesController;
import com.lemondelila.client.game.controller.GameTableInfoController;
import com.lemondelila.client.game.view.AbstractGameScreen;
import com.lemondelila.client.gamelogic.damenature.controller.DameNatureController;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureConfig;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSession;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureState;
import com.lemondelila.client.gamelogic.damenature.presenter.DameNaturePresenter;

import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import javax.swing.JTextArea;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
public final class DameNatureScreen extends AbstractGameScreen implements DameNaturePresenter.View {

    public static final ScreenId ID = ScreenId.of("dame-nature");

    private enum Mode {
        CONFIGURATION,
        GAMEPLAY
    }

    private static final GameSummary GAME_SUMMARY = new GameSummary(
            "dame-nature",
            "Dame Nature",
            1,
            4,
            "damenature",
            "Rassemblez les familles de cartes nature avant vos adversaires.",
            true,
            List.of("jeux-de-cartes")
    );

    private final DameNatureController controller;
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

    private Mode mode = Mode.CONFIGURATION;

    private final CardLayout viewLayout = new CardLayout();
    private final JPanel viewContainer = new JPanel(viewLayout);
    private final DameNatureConfigPanel configView;
    private final DameNatureGameplayPanel gameplayView;
    private final DameNaturePresenter presenter;

    private final java.util.function.Consumer<DameNatureSession> sessionListener;
    private AutoCloseable dialogBinding;

    public DameNatureScreen(DameNatureController controller,
                            AccessibilityService accessibilityService,
                            AccessibleShortcutRegistry shortcutRegistry,
                            DialogService dialogService,
                            GameRulesService rulesService) {
        super(ID, null);
        this.controller = Objects.requireNonNull(controller, "controller");
        this.accessibilityService = Objects.requireNonNull(accessibilityService, "accessibilityService");
        this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.configView = new DameNatureConfigPanel(new ConfigListener());
        this.gameplayView = new DameNatureGameplayPanel(accessibilityService);
        this.presenter = new DameNaturePresenter(controller, accessibilityService, configView, gameplayView, this);
        this.sessionListener = presenter::applySession;
        buildUi();
        this.gameActionState = ensureGameActionState();
        this.shortcutBinder = new ShortcutBinder(shortcutRegistry,
                () -> mode == Mode.GAMEPLAY && gameActionState.isEnabled(),
                this);
        this.quitController = new GameQuitController(
                this,
                dialogService,
                () -> Optional.of(GAME_SUMMARY),
                this::exitToCatalog,
                this::setStatusMessage,
                shortcutBinder
        );
        this.rulesController = new GameRulesController(
                this,
                dialogService,
                Objects.requireNonNull(rulesService, "rulesService"),
                () -> Optional.of(GAME_SUMMARY),
                this::setStatusMessage,
                gameActionState.guard(),
                shortcutBinder
        );
        this.botController = new GameBotController(
                this,
                this::setStatusMessage,
                gameActionState.guard(),
                this::addBotCommand,
                this::removeBotCommand,
                shortcutBinder
        );
        this.tableInfoController = new GameTableInfoController(
                this,
                this::setStatusMessage,
                gameActionState.guard(),
                presenter::announceTableParticipants,
                presenter::announceCurrentTurn,
                shortcutBinder
        );
        gameActionState.onDisabled(rulesController::clearLoading);
        if (botController != null) {
            gameActionState.onDisabled(botController::resetAction);
        }
    }

    @Inject
    public DameNatureScreen(DameNatureController controller,
                            ApplicationContext context) {
        this(controller,
                context.get(AccessibilityService.class),
                context.get(AccessibleShortcutRegistry.class),
                context.get(DialogService.class),
                context.get(GameRulesService.class));
    }

    private void buildUi() {
        setLayout(new BorderLayout());
        setFocusable(true);
        setFocusTraversalKeysEnabled(false);

        viewContainer.setOpaque(false);
        viewContainer.add(configView, Mode.CONFIGURATION.name());
        viewContainer.add(gameplayView, Mode.GAMEPLAY.name());
        add(viewContainer, BorderLayout.CENTER);
    }

    private void installGlobalKeyBindings() {
        resetShortcutScopes();
        shortcutScope = shortcutRegistry.openScope();
        shortcutBinder.registerStroke("ENTER", "damenature-draw", "Entree : piocher une carte.", e -> presenter.triggerDraw());
        shortcutBinder.registerStroke("UP", "damenature-target-prev", "Fleche haut : selectionner l'adversaire precedent.", e -> announce(gameplayView.cycleTarget(-1)));
        shortcutBinder.registerStroke("DOWN", "damenature-target-next", "Fleche bas : selectionner l'adversaire suivant.", e -> announce(gameplayView.cycleTarget(1)));
        shortcutBinder.registerStroke("LEFT", "damenature-card-prev", "Fleche gauche : choisir la carte precedente a demander.", e -> announce(gameplayView.cycleCard(-1)));
        shortcutBinder.registerStroke("RIGHT", "damenature-card-next", "Fleche droite : choisir la carte suivante a demander.", e -> announce(gameplayView.cycleCard(1)));
        shortcutBinder.registerLetter('e', "damenature-request", "Lettre E : demander une carte a l'adversaire selectionne.", e -> presenter.sendAskAction());
        shortcutBinder.registerLetter('r', "damenature-refresh", "Lettre R : actualiser l'etat de la partie.", e -> presenter.refreshGame());
        shortcutBinder.registerLetter('c', "damenature-open-config", "Lettre C : ouvrir la configuration.", e -> presenter.openConfiguration());

        for (int i = 0; i < 9; i++) {
            char digit = (char) ('1' + i);
            final int index = i;
            shortcutBinder.registerStroke(String.valueOf(digit), "damenature-quiz-" + digit,
                    "Chiffre " + digit + " : repondre au quiz avec l'option " + (i + 1) + ".", e -> presenter.answerQuiz(index));
        }

        JTextArea historyComponent = gameplayView.historyComponent();
        shortcutBinder.registerStroke("TAB", "damenature-focus-history", "Tab : consulter l'historique de la partie.", e ->
                SwingUtilities.invokeLater(() -> {
                    historyComponent.requestFocusInWindow();
                    historyComponent.setCaretPosition(historyComponent.getDocument().getLength());
                }));
        shortcutAttachment = shortcutRegistry.applyTo(this);
    }

    private void resetShortcutScopes() {
        closeQuietly(shortcutAttachment);
        shortcutAttachment = null;
        closeQuietly(shortcutScope);
        shortcutScope = null;
    }

    @Override
    public void showConfiguration() {
        mode = Mode.CONFIGURATION;
        viewLayout.show(viewContainer, Mode.CONFIGURATION.name());
        configView.focusFirst();
    }

    @Override
    public void showGameplay() {
        mode = Mode.GAMEPLAY;
        viewLayout.show(viewContainer, Mode.GAMEPLAY.name());
        SwingUtilities.invokeLater(() -> DameNatureScreen.this.requestFocusInWindow());
    }

    @Override
    public void requestGameplayFocus() {
        SwingUtilities.invokeLater(() -> DameNatureScreen.this.requestFocusInWindow());
    }


    @Override
    protected void setStatusMessage(String message) {
        gameplayView.setStatusMessage(message);
    }

    @Override
    public void announce(String message) {
        setStatusMessage(message);
    }

    private void exitToCatalog() {
        presenter.exitToCatalog(CatalogScreen.ID);
    }

    @Override
    public void navigate(ScreenId id) {
        super.navigate(id);
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
        bindDialogService();
        installGlobalKeyBindings();
        controller.addListener(sessionListener);
        presenter.onShow();
    }

    @Override
    public void onHide(ScreenContext context) {
        super.onHide(context);
        controller.removeListener(sessionListener);
        presenter.onHide();
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

    private static String decorateBot(String base, boolean isBot) {
        if (base == null || base.isBlank()) {
            return isBot ? "Bot" : "";
        }
        return isBot ? base + " (bot)" : base;
    }

    private CompletableFuture<Void> addBotCommand() {
        return controller.addBot().thenApply(session -> null);
    }

    private CompletableFuture<Void> removeBotCommand() {
        return controller.removeBot().thenApply(session -> null);
    }

    private final class ConfigListener implements DameNatureConfigPanel.Listener {
        @Override
        public void onLaunchRequested(DameNatureConfig config) {
            presenter.updatePendingConfig(config);
            presenter.startConfiguredGame(config);
        }

        @Override
        public void onCancelRequested() {
            presenter.cancelConfiguration();
        }

        @Override
        public void onConfigChanged(DameNatureConfig config) {
            presenter.updatePendingConfig(config);
        }
    }
}


