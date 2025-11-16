package com.lemondelila.client.gamelogic.panierexpress.view;

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
public final class PanierExpressRootView extends AbstractGameScreen {

    public static final ScreenId ID = ScreenId.of("panier-express");

    private static final String CARD_SETUP = "setup";
    private static final String CARD_GAME = "game";
    private static final GameSummary GAME_SUMMARY = new GameSummary(
            "panier-express",
            "Panier Express",
            1,
            4,
            "panierexpress",
            "Remplissez votre panier plus vite que vos adversaires.",
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
    private PanierExpressGameOptions lastUsedOptions = PanierExpressGameOptions.defaults();

    private final java.util.function.Consumer<PanierExpressSession> sessionListener;
    private final BotTurnScheduler botTurnScheduler;
    private final PanierExpressPresenter presenter;
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
        this.botTurnScheduler = new BotTurnScheduler(controller);
        this.sessionListener = session -> {
            showGameCard();
            presenter.applySession(session);
            botTurnScheduler.evaluate(session, presenter.shouldCoordinateBotTurns());
        };
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
        screenReaderBridge.getAccessibleContext().setAccessibleName("Annonces Panier Express");
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
        shortcutBinder.registerStroke("ESCAPE", "panier.esc.disabled", "Echap : aucune action durant la partie.", e -> narrate("Echap est desactive pendant la partie. Utilisez Q pour quitter."));
        shortcutBinder.registerStroke("TAB", "panier.focus.history", "Tab : consulter l'historique de la partie.", e -> focusHistory());
        shortcutBinder.registerStroke("shift TAB", "panier.focus.main", "Maj+Tab : revenir a la zone principale.", e -> focusMainArea());
        shortcutBinder.registerStroke("ENTER", "panier.execute", "Entree : action principale (lancer ou confirmer).", e -> executePrimaryAction());
        shortcutBinder.registerLetter('l', "panier.roll", "Lettre L : lancer le de.", e -> attemptRoll());
        shortcutBinder.registerLetter('r', "panier.refresh", "Lettre R : actualiser l'etat de la partie.", e -> attemptRefresh());
        shortcutBinder.registerLetter('s', "panier.score", "Lettre S : annoncer le score courant.", e -> announceScore());
        shortcutBinder.registerLetter('p', "panier.basket", "Lettre P : annoncer le contenu de votre panier.", e -> announceBasket());
        shortcutBinder.registerLetter('x', "panier.restart", "Lettre X : proposer de redemarrer la partie.", e -> promptRestart());

        for (int digit = 0; digit < 4; digit++) {
            final int answerIndex = digit;
            shortcutBinder.registerStroke(KeyStroke.getKeyStroke((char) ('1' + digit)), "panier.quiz." + digit,
                    "Chiffre " + (digit + 1) + " : repondre au quiz.", e -> submitQuizAnswer(answerIndex));
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
        controller.addSessionListener(sessionListener);
        Optional<PanierExpressSession> current = controller.currentSession();
        if (current.isPresent()) {
            showGameCard();
            presenter.applySession(current.get());
        } else {
            showSetupCard();
            SwingUtilities.invokeLater(setupPanel::focusFirstComponent);
        }
        requestFocusInWindow();
    }

    @Override
    public void onHide(ScreenContext context) {
        super.onHide(context);
        controller.removeSessionListener(sessionListener);
        botTurnScheduler.cancel();
        presenter.reset();
        resetShortcutScopes();
        releaseDialogBinding();
    }
    private void startGameWithOptions(PanierExpressGameOptions options, boolean fromShortcut) {
        if (gameInteractor.isBusy()) {
            narrate("Action déjà en cours. Patientez.");
            return;
        }
        PanierExpressGameOptions effective = options == null ? PanierExpressGameOptions.defaults() : options;
        lastUsedOptions = effective;
        showGameCard();
        String message = fromShortcut ? "Nouvelle partie en préparation..." : "Initialisation de la partie Panier Express...";
        gameInteractor.startGame(effective, message);
    }

    private void attemptRoll() {
        gameInteractor.attemptRoll();
    }

    private void attemptRefresh() {
        gameInteractor.attemptRefresh();
    }

    private void attemptNewGame() {
        startGameWithOptions(lastUsedOptions, true);
    }

    private void promptRestart() {
        if (gameInteractor.isBusy()) {
            String message = "Action déjà en cours. Patientez.";
            narrate(message);
            return;
        }
        if (!presenter.hasActiveSession()) {
            String message = "Aucune partie active à relancer.";
            narrate(message);
            return;
        }
        dialogService.confirm("Relancer Panier Express", "Souhaitez-vous relancer la partie en cours ?")
                .thenAccept(accepted -> {
                    if (Boolean.TRUE.equals(accepted)) {
                        SwingUtilities.invokeLater(() -> startGameWithOptions(lastUsedOptions, true));
                    } else {
                        String message = "Relance annulée.";
                        SwingUtilities.invokeLater(() -> {
                            narrate(message);
                        });
                    }
                });
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

    private void showSetupCard() {
        cardLayout.show(cardPanel, CARD_SETUP);
    }

    private void showGameCard() {
        cardLayout.show(cardPanel, CARD_GAME);
    }

    private void handleCancel() {
        botTurnScheduler.cancel();
        controller.reset();
        presenter.reset();
        navigate(CatalogScreen.ID);
    }

    private CompletableFuture<Void> addBotCommand() {
        return controller.addBot().thenApply(session -> null);
    }

    private CompletableFuture<Void> removeBotCommand() {
        return controller.removeBot().thenApply(session -> null);
    }

    private void narrate(String message) {
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

