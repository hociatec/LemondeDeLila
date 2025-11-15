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
import com.lemondelila.client.game.controller.GameInteractionController;
import com.lemondelila.client.game.view.AbstractGameScreen;
import com.lemondelila.client.gamelogic.damenature.controller.DameNatureController;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureConfig;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSession;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureState;

import javax.swing.AbstractAction;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.JTextArea;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.event.ActionEvent;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public final class DameNatureScreen extends AbstractGameScreen {

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
    private final GameInteractionController interactionController;
    private final ShortcutBinder shortcutBinder;

    private Mode mode = Mode.CONFIGURATION;
    private DameNatureConfig activeConfig = DameNatureConfig.defaultConfig();
    private DameNatureConfig pendingConfig = DameNatureConfig.defaultConfig();

    private final CardLayout viewLayout = new CardLayout();
    private final JPanel viewContainer = new JPanel(viewLayout);
    private final DameNatureConfigPanel configView;
    private final DameNatureGameplayPanel gameplayView;

    private DameNatureSession currentSession;
    private boolean launchInProgress;

    private final Consumer<DameNatureSession> sessionListener = this::handleSessionUpdate;

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
        buildUi();
        this.shortcutBinder = new ShortcutBinder(shortcutRegistry, () -> mode == Mode.GAMEPLAY, this);
        installGlobalKeyBindings();
        this.interactionController = new GameInteractionController(
                this,
                dialogService,
                Objects.requireNonNull(rulesService, "rulesService"),
                () -> Optional.of(GAME_SUMMARY),
                this::exitToCatalog,
                message -> gameplayView.setStatusMessage(message),
                this::addBotCommand,
                this::removeBotCommand,
                this::announceTableParticipants,
                this::announceCurrentTurn
        );
        bindInteractionController(this.interactionController);
        interactionController.setEnabled(false);
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
        shortcutRegistry.clear();
        shortcutBinder.registerStroke("ENTER", "damenature-draw", "Entree : piocher une carte.", e -> triggerDraw());
        shortcutBinder.registerStroke("UP", "damenature-target-prev", "Fleche haut : selectionner l'adversaire precedent.", e -> announce(gameplayView.cycleTarget(-1)));
        shortcutBinder.registerStroke("DOWN", "damenature-target-next", "Fleche bas : selectionner l'adversaire suivant.", e -> announce(gameplayView.cycleTarget(1)));
        shortcutBinder.registerStroke("LEFT", "damenature-card-prev", "Fleche gauche : choisir la carte precedente a demander.", e -> announce(gameplayView.cycleCard(-1)));
        shortcutBinder.registerStroke("RIGHT", "damenature-card-next", "Fleche droite : choisir la carte suivante a demander.", e -> announce(gameplayView.cycleCard(1)));
        shortcutBinder.registerLetter('e', "damenature-request", "Lettre E : demander une carte a l'adversaire selectionne.", e -> sendAskAction());
        shortcutBinder.registerLetter('r', "damenature-refresh", "Lettre R : actualiser l'etat de la partie.", e -> handleActionFeedback(controller.refresh(), "Actualisation en cours...", null, null));
        shortcutBinder.registerLetter('c', "damenature-open-config", "Lettre C : ouvrir la configuration.", e -> {
            announce("Configuration ouverte. Modifiez les options puis Entree pour relancer.");
            openConfiguration();
        });

        for (int i = 0; i < 9; i++) {
            char digit = (char) ('1' + i);
            final int index = i;
            shortcutBinder.registerStroke(String.valueOf(digit), "damenature-quiz-" + digit,
                    "Chiffre " + digit + " : repondre au quiz avec l'option " + (i + 1) + ".", e -> answerQuiz(index));
        }
        shortcutBinder.registerLetterDescription('t', "Lettre T : annoncer le tour en cours.");
        shortcutBinder.registerLetterDescription('w', "Lettre W : annoncer les joueurs presents.");

        JTextArea historyComponent = gameplayView.historyComponent();
        shortcutBinder.registerStroke("TAB", "damenature-focus-history", "Tab : consulter l'historique de la partie.", e ->
                SwingUtilities.invokeLater(() -> {
                    historyComponent.requestFocusInWindow();
                    historyComponent.setCaretPosition(historyComponent.getDocument().getLength());
                }));

    }

    private void showConfiguration() {
        mode = Mode.CONFIGURATION;
        viewLayout.show(viewContainer, Mode.CONFIGURATION.name());
        configView.focusFirst();
    }

    private void openConfiguration() {
        controller.reset();
        pendingConfig = activeConfig;
        configView.setConfig(pendingConfig);
        configView.setStatusMessage("Ajustez les options puis appuyez sur Entrée pour relancer.");
        currentSession = null;
        launchInProgress = false;
        gameplayView.reset();
        showConfiguration();
        announce(gameplayView.currentSelectionAnnouncement());
    }

    private void showGameplay() {
        mode = Mode.GAMEPLAY;
        viewLayout.show(viewContainer, Mode.GAMEPLAY.name());
        SwingUtilities.invokeLater(() -> DameNatureScreen.this.requestFocusInWindow());
    }

    private void startConfiguredGame(DameNatureConfig config) {
        launchInProgress = true;
        configView.setStatusMessage("Initialisation de la partie...");
        CompletableFuture<DameNatureSession> future = controller.startNewGame(config);
        handleActionFeedback(future, "Initialisation de la partie...", () -> {
            activeConfig = config;
            configView.setStatusMessage("Partie lancée.");
            launchInProgress = false;
            showGameplay();
        }, throwable -> {
            launchInProgress = false;
            configView.setStatusMessage("Impossible de lancer la partie : " +
                    (throwable.getMessage() == null ? "erreur inconnue" : throwable.getMessage()));
        });
    }

    private void handleSessionUpdate(DameNatureSession session) {
        if (mode != Mode.GAMEPLAY) {
            if (launchInProgress) {
                showGameplay();
            } else {
                return;
            }
        }
        launchInProgress = false;
        currentSession = session;
        gameplayView.applySession(session);
        announce(extractLastLogMessage(session));
    }

    private void sendAskAction() {
        Optional<DameNatureGameplayPanel.PlayerOption> target = gameplayView.selectedPlayer();
        if (target.isEmpty()) {
            announce("Choisissez un adversaire avec les flèches haut ou bas.");
            return;
        }
        Optional<DameNatureGameplayPanel.CardOption> card = gameplayView.selectedCard();
        if (card.isEmpty()) {
            announce("Choisissez une carte avec les flèches gauche ou droite.");
            return;
        }
        DameNatureGameplayPanel.PlayerOption player = target.get();
        DameNatureGameplayPanel.CardOption cardOption = card.get();
        handleActionFeedback(
                controller.askCard(player.id(), cardOption.familyId(), cardOption.memberId()),
                "Demande de " + cardOption.memberName() + " à " + player.displayName() + "...",
                null,
                null
        );
    }

    private void triggerDraw() {
        handleActionFeedback(controller.draw(), "Pioche en cours...", null, null);
    }

    private void answerQuiz(int index) {
        List<String> choices = gameplayView.currentQuizChoices();
        if (choices.isEmpty()) {
            announce("Aucun quiz à répondre.");
            return;
        }
        if (index < 0 || index >= choices.size()) {
            announce("Choix invalide.");
            return;
        }
        handleActionFeedback(
                controller.answerQuiz(index),
                "Réponse " + (index + 1) + " envoyée.",
                null,
                null
        );
    }

    private void announceCurrentTurn() {
        if (currentSession == null) {
            announce("Aucune partie active.");
            return;
        }
        DameNatureState state = currentSession.state();
        List<DameNatureState.Player> players = state.players();
        if (players.isEmpty() || state.turnIndex() < 0 || state.turnIndex() >= players.size()) {
            announce("Tour inconnu.");
            return;
        }
        DameNatureState.Player player = players.get(state.turnIndex());
        DameNatureState.Player self = currentSession.self();
        boolean yourTurn = self != null && self.id() == player.id();
        AccessibilityService.TurnContext context = new AccessibilityService.TurnContext(
                yourTurn,
                decorateBot(player.username(), player.isBot()),
                null
        );
        accessibilityService.announceTurn(gameplayView.turnLabel(), context);
    }

    private void handleActionFeedback(CompletableFuture<DameNatureSession> future, String pendingMessage,
                                      Runnable onSuccess,
                                      java.util.function.Consumer<Throwable> onError) {
        if (pendingMessage != null && !pendingMessage.isBlank()) {
            announce(pendingMessage);
        }
        future.whenComplete((session, error) -> SwingUtilities.invokeLater(() -> {
            if (error != null) {
                Throwable cause = error.getCause() != null ? error.getCause() : error;
                String message = cause.getMessage();
                announce(message == null || message.isBlank()
                        ? "Action impossible."
                        : message);
                if (onError != null) {
                    onError.accept(cause);
                }
            } else if (session != null) {
                if (onSuccess != null) {
                    onSuccess.run();
                }
            }
        }));
    }

    private void handleActionFeedback(CompletableFuture<DameNatureSession> future, String pendingMessage) {
        handleActionFeedback(future, pendingMessage, null, null);
    }

    private String extractLastLogMessage(DameNatureSession session) {
        List<DameNatureState.LogEntry> logs = session.state().log();
        if (logs != null && !logs.isEmpty()) {
            return logs.get(logs.size() - 1).message();
        }
        return "Action effectuée.";
    }

    private void announce(String message) {
        gameplayView.setStatusMessage(message);
    }

    private void announceTableParticipants() {
        if (currentSession == null) {
            announce("Aucune partie en cours.");
            return;
        }
        DameNatureState state = currentSession.state();
        List<DameNatureState.Player> players = state != null ? state.players() : null;
        if (players == null || players.isEmpty()) {
            announce("Aucun joueur autour de la table.");
            return;
        }
        DameNatureState.Player selfPlayer = currentSession.self();
        String selfUsername = selfPlayer != null ? selfPlayer.username() : null;
        StringBuilder builder = new StringBuilder();
        builder.append("Table de ").append(players.size())
                .append(players.size() > 1 ? " joueurs : " : " joueur : ");
        for (int i = 0; i < players.size(); i++) {
            DameNatureState.Player player = players.get(i);
            String name = player != null ? player.username() : null;
            String display = (name == null || name.isBlank()) ? "Joueur " + (i + 1) : name;
            if (selfUsername != null && name != null && name.equalsIgnoreCase(selfUsername)) {
                display = display + " (vous)";
            }
            if (player != null && player.isBot()) {
                display = display + " (bot)";
            }
            builder.append(display);
            if (i < players.size() - 1) {
                builder.append(", ");
            }
        }
        announce(builder.toString());
    }

    private void exitToCatalog() {
        controller.reset();
        gameplayView.reset();
        currentSession = null;
        launchInProgress = false;
        mode = Mode.CONFIGURATION;
        if (screenManager != null) {
            SwingUtilities.invokeLater(() -> screenManager.show(CatalogScreen.ID));
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
        dialogService.attach(this);
        controller.addListener(sessionListener);
        pendingConfig = activeConfig;
        configView.setConfig(pendingConfig);
        Optional<DameNatureSession> current = controller.currentSession();
        if (current.isPresent()) {
            activeConfig = pendingConfig;
            showGameplay();
            handleSessionUpdate(current.get());
        } else {
            gameplayView.reset();
            showGameplay();
            announce("Lancement de la partie...");
            launchInProgress = true;
            handleActionFeedback(
                    controller.startNewGame(activeConfig),
                    "Lancement de la partie...",
                    () -> launchInProgress = false,
                    throwable -> launchInProgress = false
            );
        }
        interactionController.setEnabled(true);
    }

    @Override
    public void onHide(ScreenContext context) {
        super.onHide(context);
        controller.removeListener(sessionListener);
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
            pendingConfig = config;
            startConfiguredGame(config);
        }

        @Override
        public void onCancelRequested() {
            pendingConfig = activeConfig;
            configView.setConfig(pendingConfig);
            showGameplay();
            announce(gameplayView.currentSelectionAnnouncement());
        }

        @Override
        public void onConfigChanged(DameNatureConfig config) {
            pendingConfig = config;
        }
    }
}


