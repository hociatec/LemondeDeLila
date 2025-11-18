package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressController;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressGameOptions;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressSession;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.user.model.ClientSession;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.catalogue.view.CatalogScreen;
import com.lemondelila.client.framework.access.NarrationQueue;
import com.lemondelila.client.framework.access.game.AccessibilityService;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.access.shortcut.ShortcutBinder;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.game.controller.GameActionState;
import com.lemondelila.client.game.controller.GameBotController;
import com.lemondelila.client.game.controller.GameQuitController;
import com.lemondelila.client.game.controller.GameRulesController;
import com.lemondelila.client.game.controller.GameTableInfoController;
import com.lemondelila.client.game.view.AbstractGameScreen;
import com.lemondelila.client.gamelogic.panierexpress.util.BotTurnScheduler;
import com.lemondelila.client.gamelogic.panierexpress.presenter.PanierExpressPresenter;
import com.lemondelila.client.gamelogic.panierexpress.presenter.PanierExpressScreenPresenter;

import javax.accessibility.AccessibleContext;
import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Dimension;
import java.awt.event.ActionEvent;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.function.Supplier;

/**
 * Orchestrateur principal de l'interface Panier Express.
 */
public final class PanierExpressRootView extends AbstractGameScreen implements PanierExpressScreenPresenter.View {

    public static final ScreenId ID = ScreenId.of("panier-express");

    private static final String CARD_SETUP = "setup";
    private static final String CARD_GAME = "game";
    private static final GameSummary GAME_SUMMARY = new GameSummary(
            "panier-express",
            Internationalization.text("panierexpress.name"),
            1,
            4,
            "panierexpress",
            Internationalization.text("panierexpress.summary"),
            true,
            List.of("jeux-de-plateau")
    );

    private final PanierExpressController controller;
    private final Supplier<NarrationQueue> narrationQueueSupplier;
    private final ClientSession clientSession;
    private final DialogService dialogService;
    private final GameActionState gameActionState;
    private final GameQuitController quitController;
    private final GameRulesController rulesController;
    private final GameBotController botController;
    private final GameTableInfoController tableInfoController;
    private final AccessibleShortcutRegistry shortcutRegistry;
    private final ShortcutBinder shortcutBinder;
    private final JLabel screenReaderBridge = new JLabel();
    private String lastScreenReaderMessage = "";
    private boolean screenReaderToggle;

    private final CardLayout cardLayout = new CardLayout();
    private final JPanel cardPanel = new JPanel(cardLayout);
    private final PanierExpressSetupPanel setupPanel;
    private final PanierExpressGamePanel gamePanel;

    private final PanierExpressGameInteractor gameInteractor;
    private final PanierExpressPresenter presenter;
    private final PanierExpressScreenPresenter screenPresenter;
    private AutoCloseable dialogBinding;
    private AutoCloseable shortcutScope;
    private AutoCloseable shortcutAttachment;

    public PanierExpressRootView(PanierExpressController controller,
                                 Supplier<NarrationQueue> narrationQueueSupplier,
                                 ClientSession clientSession,
                                 SoundEffectManager soundManager,
                                 DialogService dialogService,
                                 GameRulesService rulesService,
                                 AccessibilityService accessibilityService,
                                 AccessibleShortcutRegistry shortcutRegistry) {
        super(ID, null);
        this.controller = Objects.requireNonNull(controller, "controller");
        this.narrationQueueSupplier = Objects.requireNonNull(narrationQueueSupplier, "narrationQueueSupplier");
        this.clientSession = Objects.requireNonNull(clientSession, "clientSession");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
        SoundEffectManager validatedSoundManager = Objects.requireNonNull(soundManager, "soundManager");
        PanierExpressVoiceFeedback voiceFeedback = new PanierExpressVoiceFeedback(
                narrationQueueSupplier,
                validatedSoundManager,
                () -> screenReaderBridge
        );
        this.gamePanel = new PanierExpressGamePanel();
        this.presenter = new PanierExpressPresenter(
                this.gamePanel,
                voiceFeedback,
                Objects.requireNonNull(accessibilityService, "accessibilityService"),
                screenReaderBridge,
                this::currentUsername,
                this::narrate
        );
        this.gameInteractor = new PanierExpressGameInteractor(controller, presenter, this::narrate);
        BotTurnScheduler botTurnScheduler = new BotTurnScheduler(controller);
        this.screenPresenter = new PanierExpressScreenPresenter(controller, gameInteractor, botTurnScheduler, dialogService);
        this.screenPresenter.bind(this);
        this.gameActionState = ensureGameActionState();
        this.shortcutBinder = new ShortcutBinder(shortcutRegistry, gameActionState.guard(), this, cardPanel);

        Supplier<Optional<GameSummary>> gameSupplier = () -> Optional.of(GAME_SUMMARY);
        Consumer<String> statusConsumer = this::handleInteractionStatus;

        this.quitController = new GameQuitController(
                this,
                dialogService,
                gameSupplier,
                this::handleCancel,
                statusConsumer,
                shortcutBinder
        );
        this.rulesController = new GameRulesController(
                this,
                dialogService,
                rulesService,
                gameSupplier,
                statusConsumer,
                gameActionState.guard(),
                shortcutBinder
        );
        this.botController = new GameBotController(
                this,
                statusConsumer,
                gameActionState.guard(),
                this::addBotCommand,
                this::removeBotCommand,
                shortcutBinder
        );
        this.tableInfoController = new GameTableInfoController(
                this,
                statusConsumer,
                gameActionState.guard(),
                presenter::announcePlayers,
                presenter::announceCurrentTurn,
                shortcutBinder
        );
        gameActionState.onDisabled(rulesController::clearLoading);
        if (botController != null) {
            gameActionState.onDisabled(botController::resetAction);
        }

        this.setupPanel = new PanierExpressSetupPanel(new PanierExpressSetupPanel.Listener() {
            @Override
            public void onStart(PanierExpressGameOptions options) {
                startGameWithOptions(options, false);
            }

            @Override
            public void onCancel() {
                handleCancel();
            }
        });

        cardPanel.setLayout(cardLayout);
        cardPanel.add(setupPanel, CARD_SETUP);
        cardPanel.add(gamePanel, CARD_GAME);

        setLayout(new BorderLayout());
        screenReaderBridge.setFocusable(false);
        screenReaderBridge.setOpaque(false);
        screenReaderBridge.setForeground(getBackground());
        screenReaderBridge.setVisible(true);
        Dimension hiddenSize = new Dimension(1, 1);
        screenReaderBridge.setPreferredSize(hiddenSize);
        screenReaderBridge.setMinimumSize(hiddenSize);
        screenReaderBridge.setMaximumSize(hiddenSize);
        screenReaderBridge.setText(" ");
        screenReaderBridge.getAccessibleContext().setAccessibleName(Internationalization.text("panierexpress.screenreader.name"));
        add(cardPanel, BorderLayout.CENTER);
        add(screenReaderBridge, BorderLayout.SOUTH);

        setFocusable(true);
        setRequestFocusEnabled(true);
    }

    @Inject
    public PanierExpressRootView(PanierExpressController controller,
                                 ApplicationContext context,
                                 ClientSession clientSession,
                                 SoundEffectManager soundManager,
                                 DialogService dialogService) {
        this(controller,
                () -> context.get(NarrationQueue.class),
                clientSession,
                soundManager,
                dialogService,
                context.get(GameRulesService.class),
                context.get(AccessibilityService.class),
                context.get(AccessibleShortcutRegistry.class));
    }

    private void installShortcuts() {
        resetShortcutScopes();
        shortcutScope = shortcutRegistry.openScope();
        shortcutBinder.registerStroke("ESCAPE", "panier.esc.disabled",
                Internationalization.text("panier.shortcut.esc.desc"),
                e -> narrate(Internationalization.text("panier.shortcut.esc.message")));
        shortcutBinder.registerStroke("TAB", "panier.focus.history",
                Internationalization.text("panier.shortcut.tab.desc"),
                e -> focusHistory());
        shortcutBinder.registerStroke("shift TAB", "panier.focus.main",
                Internationalization.text("panier.shortcut.shift.tab.desc"),
                e -> focusMainArea());
        shortcutBinder.registerStroke("ENTER", "panier.execute",
                Internationalization.text("panier.shortcut.enter.desc"),
                e -> executePrimaryAction());
        shortcutBinder.registerLetter('l', "panier.roll",
                Internationalization.text("panier.shortcut.l.desc"),
                e -> attemptRoll());
        shortcutBinder.registerLetter('r', "panier.refresh",
                Internationalization.text("panier.shortcut.r.desc"),
                e -> attemptRefresh());
        shortcutBinder.registerLetter('s', "panier.score",
                Internationalization.text("panier.shortcut.s.desc"),
                e -> announceScore());
        shortcutBinder.registerLetter('p', "panier.basket",
                Internationalization.text("panier.shortcut.p.desc"),
                e -> announceBasket());
        shortcutBinder.registerLetter('x', "panier.restart",
                Internationalization.text("panier.shortcut.x.desc"),
                e -> promptRestart());

        for (int digit = 0; digit < 4; digit++) {
            final int answerIndex = digit;
            shortcutBinder.registerStroke(KeyStroke.getKeyStroke((char) ('1' + digit)), "panier.quiz." + digit,
                    Internationalization.text("panier.shortcut.quiz.desc", digit + 1),
                    e -> submitQuizAnswer(answerIndex));
        }
        shortcutAttachment = shortcutRegistry.applyTo(this);
    }

    private void resetShortcutScopes() {
        closeQuietly(shortcutAttachment);
        shortcutAttachment = null;
        closeQuietly(shortcutScope);
        shortcutScope = null;
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
        installShortcuts();
        screenPresenter.onShow();
    }

    @Override
    public void onHide(ScreenContext context) {
        super.onHide(context);
        screenPresenter.onHide();
        presenter.reset();
        resetShortcutScopes();
        releaseDialogBinding();
    }
    private void startGameWithOptions(PanierExpressGameOptions options, boolean fromShortcut) {
        screenPresenter.startGame(options, fromShortcut);
    }


    private void attemptRoll() {
        screenPresenter.attemptRoll();
    }


    private void attemptRefresh() {
        screenPresenter.attemptRefresh();
    }


    private void attemptNewGame() {
        screenPresenter.attemptNewGame();
    }


    private void promptRestart() {
        screenPresenter.promptRestart();
    }

    private void submitQuizAnswer(int index) {
        gameInteractor.submitQuizAnswer(index);
    }

    private void announceCurrentTurn() {
        presenter.announceCurrentTurn();
    }

    private void announceScore() {
        presenter.announceScore();
    }

    private void announceBasket() {
        presenter.announceBasket();
    }

    private void announcePlayers() {
        presenter.announcePlayers();
    }

    private void executePrimaryAction() {
        gameInteractor.attemptRoll();
    }

    private void focusHistory() {
        showGameCard();
        gamePanel.focusHistory();
    }

    private void focusMainArea() {
        showGameCard();
        gamePanel.focusMain();
    }

    @Override
    public void showSetupCard() {
        cardLayout.show(cardPanel, CARD_SETUP);
    }

    @Override
    public void showGameCard() {
        cardLayout.show(cardPanel, CARD_GAME);
    }

    @Override
    public void renderSession(PanierExpressSession session) {
        presenter.applySession(session);
    }

    @Override
    public void resetGameView() {
        presenter.reset();
        showSetupCard();
    }

    @Override
    public void navigateToCatalog() {
        navigate(CatalogScreen.ID);
    }

    @Override
    public void focusSetupPanel() {
        SwingUtilities.invokeLater(setupPanel::focusFirstComponent);
    }

    private void handleCancel() {
        screenPresenter.handleCancel();
    }


    private CompletableFuture<Void> addBotCommand() {
        return controller.addBot().thenApply(session -> null);
    }

    private CompletableFuture<Void> removeBotCommand() {
        return controller.removeBot().thenApply(session -> null);
    }

    @Override
    public boolean hasActiveSession() {
        return presenter.hasActiveSession();
    }

    @Override
    public boolean shouldCoordinateBotTurns() {
        return presenter.shouldCoordinateBotTurns();
    }

    @Override
    public void requestRootFocus() {
        requestFocusInWindow();
    }

    @Override
    public void narrate(String message) {
        announceForScreenReader(message);
        try {
            NarrationQueue queue = narrationQueueSupplier.get();
            if (queue != null) {
                queue.enqueue(screenReaderBridge, message);
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void setStatusMessage(String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        gamePanel.updateStatus(message, message);
        narrate(message);
    }

    private void handleInteractionStatus(String message) {
        setStatusMessage(message);
    }

    private void announceForScreenReader(String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        String payload = message;
        if (message.equals(lastScreenReaderMessage)) {
            screenReaderToggle = !screenReaderToggle;
            payload = message + (screenReaderToggle ? " \u200B" : " \u200C");
        } else {
            screenReaderToggle = false;
        }
        lastScreenReaderMessage = payload;
        AccessibleContext context = screenReaderBridge.getAccessibleContext();
        if (context == null) {
            return;
        }
        final String textPayload = payload;
        Runnable fire = () -> {
            screenReaderBridge.setText(textPayload);
            context.setAccessibleDescription(textPayload);
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_TEXT_PROPERTY,
                    null,
                    textPayload
            );
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_NAME_PROPERTY,
                    null,
                    textPayload
            );
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_DESCRIPTION_PROPERTY,
                    null,
                    textPayload
            );
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_VISIBLE_DATA_PROPERTY,
                    null,
                    textPayload
            );
        };
        if (SwingUtilities.isEventDispatchThread()) {
            fire.run();
        } else {
            SwingUtilities.invokeLater(fire);
        }
    }

    private String currentUsername() {
        return clientSession.authenticated().map(ClientSession.AuthState::username).orElse(null);
    }

}





