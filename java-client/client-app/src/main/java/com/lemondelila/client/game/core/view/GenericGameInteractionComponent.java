package com.lemondelila.client.game.core.view;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.game.core.controller.GenericGameInteractionController;
import com.lemondelila.client.game.core.model.ActionRequest;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.model.PrimaryActionDescriptor;
import com.lemondelila.client.game.core.service.GameAnnouncementService;
import com.lemondelila.client.game.core.viewmodel.AvailableActionMatcher;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.service.GameActionEmitter;
import com.lemondelila.client.game.quiz.view.GameQuizComponent;
import com.lemondelila.client.game.quiz.view.GameQuizComponentFactory;
import com.lemondelila.client.game.quiz.view.GameQuizPanel;
import com.lemondelila.client.game.core.viewmodel.GameAnnouncementFormatter;
import com.lemondelila.client.game.core.viewmodel.GameExchangeNavigator;
import com.lemondelila.client.game.core.viewmodel.GameInfoLabelFormatter;
import com.lemondelila.client.game.core.viewmodel.GameShortcutBinder;
import com.lemondelila.client.game.core.viewmodel.PendingActionSelector;
import com.lemondelila.client.game.core.viewmodel.BotTurnGate;
import com.lemondelila.client.game.core.viewmodel.BotTurnLockTracker;
import com.lemondelila.client.game.core.viewmodel.DynamicShortcutResolver;
import com.lemondelila.client.game.core.viewmodel.PendingViewModel;
import com.lemondelila.client.game.core.viewmodel.PlayerCollectionsViewModel;
import com.lemondelila.client.game.core.viewmodel.TurnAnnouncementTracker;
import com.lemondelila.client.game.core.viewmodel.PositionAnnouncementFormatter;
import com.lemondelila.client.game.core.viewmodel.GameActionUtils;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.room.service.RoomParticipantsMapper;
import com.lemondelila.client.game.turn.controller.TurnController;
import com.lemondelila.client.game.turn.view.GameStatusPanel;
import com.lemondelila.client.security.EncryptedSessionVault;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import javax.swing.DefaultListModel;
import javax.swing.JList;

import javax.swing.AbstractAction;
import javax.swing.ActionMap;
import javax.swing.InputMap;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.KeyStroke;
import javax.swing.JDialog;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.KeyboardFocusManager;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Base64;

/**
 * Composant d'interaction gĂŠnĂŠrique pour les jeux (statut, quiz, logs, action primaire).
 */
public final class GenericGameInteractionComponent extends JPanel implements GameInteractionComponent, GenericGameInteractionController.Listener, PrimaryActionCapable {

    private static final Logger LOGGER = LoggerFactory.getLogger(GenericGameInteractionComponent.class);
    private final GenericGameInteractionController controller;
    private final GameActionEmitter emitter;
    private final GameHistoryController history;
    private final TableState tableState;
    private final Runnable startHandler;
    private final Runnable resetHandler;
    private final GameStatusPanel statusPanel;
    private final GameQuizComponent quizComponent;
    private final PrimaryActionDescriptor primaryAction;
    private final boolean autoPrimaryAfterStart;
    private final TurnController turnController;
    private final ObjectMapper mapper = new ObjectMapper();
    private final GameAnnouncementFormatter announcementFormatter = new GameAnnouncementFormatter();
    private final GameInfoLabelFormatter infoLabelFormatter = new GameInfoLabelFormatter();
    private final GameExchangeNavigator exchangeNavigator = new GameExchangeNavigator();
    private final PendingActionSelector pendingActionSelector = new PendingActionSelector();
    private final BotTurnGate botTurnGate = new BotTurnGate();
    private final BotTurnLockTracker botTurnLockTracker;
    private final PendingViewModel pendingViewModel = new PendingViewModel();
    private final DynamicShortcutResolver shortcutResolver = new DynamicShortcutResolver(mapper);
    private final GamePendingRenderer pendingRenderer = new GamePendingRenderer(mapper, pendingViewModel, exchangeNavigator);
    private final PlayerCollectionsViewModel playerCollectionsViewModel = new PlayerCollectionsViewModel();
    private final GamePlayerCollectionsRenderer playerCollectionsRenderer = new GamePlayerCollectionsRenderer(playerCollectionsViewModel);
    private final TurnAnnouncementTracker turnAnnouncementTracker = new TurnAnnouncementTracker();
    private final GameAnnouncementService announcementService;
    private final GameStatusRenderer statusRenderer;
    private final GameTurnRenderer turnRenderer;
    private final GameActionsRenderer actionsRenderer;
    private final GameExchangeRenderer exchangeRenderer;
    private final JLabel infoLabel = new JLabel();
    private final JLabel pendingLabel = new JLabel();
    private final JLabel shoppingLabel = new JLabel();
    private final JLabel basketLabel = new JLabel();
    private final JLabel inventoryLabel = new JLabel();
    private final String localUsername;
    private final Integer localUserId;
    private Integer localPlayerId;
    private final FocusHighlighter focusHighlighter;
    private GameQuizHandler quizHandler;
    private GameDialogManager dialogManager;
    private GenericGameState lastState;
    private java.util.List<String> lastSelfShopping = java.util.List.of();
    private java.util.List<String> lastSelfBasket = java.util.List.of();
    private java.util.List<String> lastSelfInventory = java.util.List.of();
    private java.util.List<String> shoppingView = java.util.List.of();
    private java.util.List<String> basketView = java.util.List.of();
    private java.util.List<String> inventoryView = java.util.List.of();
    private java.util.List<Map<String, Object>> dynamicShortcuts = java.util.List.of();
    private GameShortcutBinder shortcutBinder;
    private InputMap windowMapRef;
    private ActionMap actionMapRef;
    private final DefaultListModel<GenericGameState.GenericAction> actionsModel = new DefaultListModel<>();
    private final JList<GenericGameState.GenericAction> actionsList = new JList<>(actionsModel);
    private Integer lastRollSeen;
    private boolean exchangePending;
    private boolean gameStarted;
    private boolean startAnnounced;
    private boolean firstStateRendered;
    private boolean autoPrimaryDispatched;
    private boolean handReceivedAnnounced;
    private static final String CARD_DEFAULT = "card.default";
    private static final String CARD_EXCHANGE = "card.exchange";
    private final JPanel cardContainer = new JPanel(new CardLayout());
    private JComponent exchangeCard;
    private boolean exchangeActive;

    private JDialog askModal;
    private JLabel askModalLabel;

    public GenericGameInteractionComponent(GenericGameInteractionController controller,
                                           GameActionEmitter emitter,
                                           GameHistoryController history,
                                           TableState tableState,
                                           TurnController turnController,
                                           FocusHighlighter focusHighlighter,
                                           Optional<GameQuizComponentFactory> quizFactory,
                                           PrimaryActionDescriptor primaryAction,
                                           Runnable startHandler,
                                           Runnable resetHandler,
                                           boolean autoPrimaryAfterStart) {
        super(new BorderLayout(8, 8));
        setFocusable(true);
        this.controller = Objects.requireNonNull(controller, "controller");
        this.emitter = Objects.requireNonNull(emitter, "emitter");
        this.history = Objects.requireNonNull(history, "history");
        this.tableState = Objects.requireNonNull(tableState, "tableState");
        this.focusHighlighter = Objects.requireNonNull(focusHighlighter, "focusHighlighter");
        this.announcementService = new GameAnnouncementService(this.tableState, msg -> this.emitter.announceEvent(msg));
        this.primaryAction = primaryAction;
        this.startHandler = startHandler;
        this.resetHandler = resetHandler;
        this.autoPrimaryAfterStart = autoPrimaryAfterStart;
        this.turnController = Objects.requireNonNull(turnController, "turnController");
        var session = EncryptedSessionVault.defaultVault().load();
        this.localUsername = session.map(EncryptedSessionVault.SessionRecord::username).orElse(null);
        this.localUserId = decodeUserIdFromToken(session.map(EncryptedSessionVault.SessionRecord::token).orElse(null));
        this.localPlayerId = null;
        this.botTurnLockTracker = new BotTurnLockTracker(this.tableState);
        this.statusPanel = new GameStatusPanel(focusHighlighter);
        this.statusRenderer = new GameStatusRenderer(
                this.statusPanel,
                this.tableState,
                msg -> this.emitter.announceEvent(msg),
                this.announcementFormatter
        );
        if (quizFactory != null && quizFactory.isPresent()) {
            this.quizComponent = quizFactory.get().create(focusHighlighter);
        } else {
            // Fallback simple pour s'assurer que le quiz s'affiche mÃªme si aucune fabrique n'est injectÃ©e.
            this.quizComponent = new GameQuizPanel(focusHighlighter);
        }
        this.quizHandler = new GameQuizHandler(
            quizComponent,
            localPlayerId,
            announcementFormatter,
            infoLabelFormatter,
            msg -> emitter.announceEvent(msg),
            text -> infoLabel.setText(text),
            this::handleQuizAnswerSubmission
        );
        this.dialogManager = new GameDialogManager(
            localPlayerId,
            infoLabelFormatter,
            text -> infoLabel.setText(text),
            this::submitAction,
            this::hasActionMatching
        );
        this.turnRenderer = new GameTurnRenderer(
                this.tableState,
                this.turnController,
                this.turnAnnouncementTracker,
                this.statusRenderer,
                msg -> this.emitter.announceEvent(msg)
        );
        this.exchangeRenderer = new GameExchangeRenderer(
                this.tableState,
                this.exchangeNavigator,
                this.actionsModel,
                this.actionsList,
                this::toPayload,
                msg -> this.emitter.announceEvent(msg),
                infoLabel::setText
        );
        this.actionsRenderer = new GameActionsRenderer(
                this.mapper,
                this.pendingActionSelector,
                this.actionsModel,
                this.actionsList,
                this.dialogManager::refreshDiscardOptions,
                this::refreshExchangeInfoLabel,
                this::announceExchangeSelectionIfNeeded
        );
        buildUi(this.focusHighlighter);
        this.statusRenderer.clear();
    }

    private void handleQuizAnswerSubmission(String actionType, String answer) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("answer", answer);
        if (localPlayerId != null) {
            payload.put("playerId", localPlayerId);
        }
        var maybeAction = AvailableActionMatcher.findFirstMatching(
                availableActionsSnapshot(),
                actionType,
                payload,
                this::toPayload
        );
        if (maybeAction.isEmpty()) {
            emitter.announceError("Action quiz indisponible (pas d'action serveur correspondante).");
            return;
        }
        dispatchAction(maybeAction.get());
    }

    private void submitAction(String actionType, Map<String, Object> payload) {
        // Certaines actions ont un payload "template" côté serveur et doivent être envoyées
        // avec le payload construit côté client (ask/discard).
        if ("ask_card".equalsIgnoreCase(actionType) || "discard_card".equalsIgnoreCase(actionType)) {
            // Vérifier que le serveur expose bien ce type d'action (garde-fou UX).
            var availableByType = AvailableActionMatcher.findFirstMatching(
                    availableActionsSnapshot(),
                    actionType,
                    Map.of(),
                    this::toPayload
            );
            if (availableByType.isEmpty()) {
                emitter.announceError("Action " + actionType + " indisponible (pas d'action serveur correspondante).");
                return;
            }
            controller.sendActions(List.of(ActionRequest.of(actionType, payload)));
            return;
        }
        var maybeAction = AvailableActionMatcher.findFirstMatching(
                availableActionsSnapshot(),
                actionType,
                payload,
                this::toPayload
        );
        if (maybeAction.isEmpty()) {
            emitter.announceError("Action " + actionType + " indisponible (pas d'action serveur correspondante).");
            return;
        }
        dispatchAction(maybeAction.get());
    }

    private void buildUi(FocusHighlighter focusHighlighter) {
        // Les dialogues (demande / défausse) sont pilotés au clavier via TAB et flèches :
        // on désactive la navigation de focus par TAB pour éviter que le focus parte dans l'historique.
        disableFocusTraversalRecursively(this);
        AccessibleDecorator.apply(infoLabel, AccessibleSpec.builder()
                .name("Information")
                .description("Informations sur la partie")
                .build());
        focusHighlighter.apply(infoLabel);
        AccessibleDecorator.apply(shoppingLabel, AccessibleSpec.builder()
                .name("Liste de courses")
                .description("Contenu actuel de la liste de courses du joueur")
                .build());
        focusHighlighter.apply(shoppingLabel);
        AccessibleDecorator.apply(basketLabel, AccessibleSpec.builder()
                .name("Panier")
                .description("Contenu du panier du joueur")
                .build());
        focusHighlighter.apply(basketLabel);
        AccessibleDecorator.apply(inventoryLabel, AccessibleSpec.builder()
                .name("Inventaire")
                .description("Cartes en inventaire du joueur")
                .build());
        focusHighlighter.apply(inventoryLabel);
        AccessibleDecorator.apply(pendingLabel, AccessibleSpec.builder()
                .name("Action en attente")
                .description("Indication sur l’action ou le vote en attente")
                .build());
        focusHighlighter.apply(pendingLabel);
        AccessibleDecorator.apply(actionsList, AccessibleSpec.builder()
                .name("Actions disponibles")
                .description("Liste des actions exposées par le serveur")
                .build());
        focusHighlighter.apply(actionsList);

        JPanel left = new JPanel(new BorderLayout(6, 6));
        left.add(statusPanel, BorderLayout.NORTH);
        if (quizComponent != null) {
            left.add(quizComponent.getComponent(), BorderLayout.CENTER);
        }
        JPanel infoPanel = new JPanel(new BorderLayout(4, 4));
        javax.swing.JPanel topInfo = new javax.swing.JPanel(new java.awt.GridLayout(0, 1, 2, 2));
        topInfo.add(pendingLabel);
        topInfo.add(shoppingLabel);
        topInfo.add(basketLabel);
        topInfo.add(inventoryLabel);
        infoPanel.add(topInfo, BorderLayout.NORTH);
        javax.swing.JLabel shortcutsLabel = new javax.swing.JLabel("Raccourcis : [Espace] piocher, [Entrée] lancer/valider, [X] réinitialiser");
        AccessibleDecorator.apply(shortcutsLabel, AccessibleSpec.builder()
                .name("Raccourcis clavier")
                .description("Espace pour piocher, Entrée pour lancer/valider quand disponible")
                .build());
        focusHighlighter.apply(shortcutsLabel);
        infoPanel.add(shortcutsLabel, BorderLayout.CENTER);
        infoPanel.add(infoLabel, BorderLayout.SOUTH);
        left.add(infoPanel, BorderLayout.SOUTH);

        cardContainer.add(left, CARD_DEFAULT);
        add(cardContainer, BorderLayout.CENTER);
        // Liste cachée : les actions se déclenchent via les raccourcis clavier.
        actionsList.setVisible(false);
        disableFocusTraversalRecursively(actionsList);

        actionsList.addListSelectionListener(e -> refreshInfoLabel());
        actionsList.addMouseListener(new java.awt.event.MouseAdapter() {
            @Override
            public void mouseClicked(java.awt.event.MouseEvent e) {
                if (e.getClickCount() >= 2) {
                    dispatchSelectedAction();
                }
            }
        });
        javax.swing.InputMap listMap = actionsList.getInputMap(JComponent.WHEN_FOCUSED);
        javax.swing.ActionMap listActions = actionsList.getActionMap();
        KeyboardEventRouter listRouter = new KeyboardEventRouter(listMap, listActions);
        listRouter.bind("ENTER", "actions.trigger", () -> {
            if (quizHandler.submitIfActive()) {
                return;
            }
            dispatchSelectedAction();
        });

        javax.swing.InputMap windowMap = getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        javax.swing.ActionMap actions = getActionMap();
        this.windowMapRef = windowMap;
        this.actionMapRef = actions;
        this.shortcutBinder = new GameShortcutBinder(windowMap, actions);
        KeyboardEventRouter router = new KeyboardEventRouter(windowMap, actions);
        router.bind("ENTER", "shortcut.roll-or-primary", this::handleRollShortcut);
        router.bind("SPACE", "shortcut.draw", () -> {
            if (quizHandler.submitIfActive()) return;
            handleDrawShortcut();
        });
        // Le raccourci X est géré au niveau "table" (RoomTableScreen) pour fonctionner quel que soit le focus.
        // Demande de carte : navigation du mini-dialogue
        router.bind("TAB", "ask.tab", () -> {
            if (dialogManager.isAskDialogOpen()) {
                dialogManager.moveAskFocus(false);
            }
        });
        router.bind("shift TAB", "ask.tab.back", () -> {
            if (dialogManager.isAskDialogOpen()) {
                dialogManager.moveAskFocus(true);
            }
        });
        router.bind("LEFT", "ask.prev", () -> {
            if (dialogManager.isAskDialogOpen()) {
                dialogManager.moveAskSelection(-1);
            }
        });
        router.bind("RIGHT", "ask.next", () -> {
            if (dialogManager.isAskDialogOpen()) {
                dialogManager.moveAskSelection(1);
            }
        });
        router.bind("ESCAPE", "ask.cancel", () -> {
            if (dialogManager.isAskDialogOpen()) {
                dialogManager.cancelAskDialog();
            }
            if (dialogManager.isDiscardDialogOpen()) {
                dialogManager.cancelDiscardDialog();
            }
        });

        // Statistiques rapides : touche S
        router.bind("S", "stats.show", this::announceStats);
        // Demande de carte (Dame Nature) : touche D (fallback même si raccourci dynamique absent).
        router.bind("D", "ask.open", () -> {
            if (quizHandler.submitIfActive()) return;
            if (blockIfBotTurn()) return;
            if (!isTableStarted()) return;
            // Si l'action est dispo, elle ouvrira le mini-dialogue côté client.
            boolean sent = dispatchActionMatching(a -> "ask_card".equalsIgnoreCase(a.type()));
            if (!sent) {
                emitter.announceError("Demande de carte indisponible (pas d'action serveur : pas votre tour ?).");
            }
        });
        // Familles constituées (Dame Nature) : touche F (fallback même si le serveur ne fournit pas de raccourci).
        router.bind("F", "books.show", () -> {
            if (quizHandler.submitIfActive()) return;
            if (!isTableStarted()) return;
            announcementService.announceBooks(lastState);
        });
        router.bind("A", "ask.answer.accept", () -> sendAskAnswer(true));
        router.bind("R", "ask.answer.refuse", () -> sendAskAnswer(false));
        configureQuizNavigation(windowMap, actions);
        actionsList.setCellRenderer((list, value, index, isSelected, cellHasFocus) -> {
            String label = (value.label() != null && !value.label().isBlank()) ? value.label() : value.type();
            return new javax.swing.JLabel(label);
        });
    }

    private void configureQuizNavigation(InputMap inputMap, ActionMap actions) {
        if (quizComponent == null) {
            return;
        }
        actions.put("quiz.navigate.up", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                handleQuizNavigation(-1);
            }
        });
        actions.put("quiz.navigate.down", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                handleQuizNavigation(1);
            }
        });
        inputMap.put(KeyStroke.getKeyStroke("UP"), "quiz.navigate.up");
        inputMap.put(KeyStroke.getKeyStroke("DOWN"), "quiz.navigate.down");
        bindQuizNumberShortcuts(inputMap, actions);
    }

    private void bindQuizNumberShortcuts(InputMap inputMap, ActionMap actions) {
        if (quizComponent == null) {
            return;
        }
        // Désactivé : la sélection se fait uniquement avec flèche haut/bas puis Entrée.
    }

    public void registerExchangeComponent(JComponent component) {
        if (component == null || exchangeCard != null) {
            return;
        }
        this.exchangeCard = component;
        cardContainer.add(exchangeCard, CARD_EXCHANGE);
    }

    public void showExchangePanel(boolean show) {
        if (exchangeCard == null) {
            return;
        }
        CardLayout layout = (CardLayout) cardContainer.getLayout();
        layout.show(cardContainer, show ? CARD_EXCHANGE : CARD_DEFAULT);
        exchangeActive = show;
    }

    private void handleQuizNavigation(int delta) {
        if (dialogManager.isAskDialogOpen()) {
            dialogManager.moveAskSelection(delta);
            emitter.announceEvent(dialogManager.buildAskAnnouncementText());
            return;
        }
        if (dialogManager.isDiscardDialogOpen()) {
            dialogManager.moveDiscardSelection(delta);
            emitter.announceEvent(simplifyDiscardAnnouncement(lastState, dialogManager.buildDiscardAnnouncementText()));
            return;
        }
        if (!quizHandler.isActive()) {
            // Pas de quiz actif : on recycle la navigation pour les échanges si besoin.
            if (hasActionMatching(GameActionUtils::isDiscardAction)) {
                dialogManager.openDiscardDialog();
                if (delta != 0) {
                    dialogManager.moveDiscardSelection(delta);
                }
                emitter.announceEvent(simplifyDiscardAnnouncement(lastState, dialogManager.buildDiscardAnnouncementText()));
                return;
            }
            exchangeRenderer.handleNavigation(delta, exchangePending);
            return;
        }
        quizHandler.handleNavigation(delta);
    }

    private void handleQuizAnswerShortcut(int index) {
        quizHandler.handleAnswerShortcut(index);
    }

    @Override
    public ScreenId id() {
        return ScreenId.of("generic-game-interaction");
    }

    @Override
    public JComponent getComponent() {
        return this;
    }

    public void onAttach(int roomId) {
        statusRenderer.resetLogs();
        turnAnnouncementTracker.reset();
        botTurnLockTracker.reset();
        startAnnounced = false;
        firstStateRendered = false;
        autoPrimaryDispatched = false;
        handReceivedAnnounced = false;
        requestFocusInWindow();
        controller.attach(roomId, this);
    }

    private static void disableFocusTraversalRecursively(java.awt.Component component) {
        if (component == null) return;
        try {
            component.setFocusTraversalKeysEnabled(false);
            if (component instanceof java.awt.Container container) {
                for (java.awt.Component child : container.getComponents()) {
                    disableFocusTraversalRecursively(child);
                }
            }
        } catch (Exception ignored) {
            // some swing components may throw in odd states; best-effort only
        }
    }

    public void onDetach() {
        controller.detach();
    }

    @Override
    public void refreshState() {
        controller.refresh();
    }

    @Override
    public void onState(GenericGameState state) {
        this.lastState = state;
        SwingUtilities.invokeLater(() -> {
            renderState(state);
        });
    }

    @Override
    public void onError(String message) {
        SwingUtilities.invokeLater(() -> {
            emitter.announceError(message);
            // Ne pas réinitialiser l'état de démarrage sur une erreur d'action ponctuelle,
            // sinon chaque réponse serveur réaffiche "La partie vient de démarrer".
            statusRenderer.clear();
            turnAnnouncementTracker.clearLastSeen();
            statusRenderer.resetLogs();
        });
    }

    private void renderState(GenericGameState state) {
        statusRenderer.renderHeader(state);
        boolean startedFlag = "started".equalsIgnoreCase(state.status());
        boolean wasStarted = gameStarted;
        gameStarted = startedFlag;
        // Synchroniser participants avant de traiter le tour pour disposer de l'ordre correct.
        syncTableState(state);

        if (!firstStateRendered) {
            firstStateRendered = true;
            startAnnounced = startedFlag;
        } else if (startedFlag && !wasStarted && !startAnnounced) {
            tableState.markStarted();
            emitter.announceEvent(Internationalization.text("game.game.started"));
            startAnnounced = true;
            if (autoPrimaryAfterStart && !autoPrimaryDispatched && primaryAction != null) {
                autoPrimaryDispatched = true;
                controller.triggerPrimaryAction();
            }
        } else if (!startedFlag) {
            startAnnounced = false;
            // ne pas réinitialiser pregameAnnounced pour éviter les répétitions avant le démarrage
            autoPrimaryDispatched = false;
            handReceivedAnnounced = false;
        }

        if (startedFlag && isDameNature(state) && !handReceivedAnnounced) {
            if (!announcementService.handLabels(state).isEmpty()) {
                announcementService.announceHandReceived(state);
                handReceivedAnnounced = true;
            }
        }
        statusRenderer.renderLogs(state.logs());
        turnRenderer.renderTurn(state);
        renderPlayerCollections(state);
        botTurnLockTracker.update(state, infoLabel::setText);
        if (state.pending() instanceof GenericGameState.PendingQuiz quiz) {
            renderQuiz(quiz);
        } else {
            renderQuiz(null);
        }
        renderPending(state.pending());
        renderActions(state);
        if (dialogManager.isAskDialogOpen()) {
            dialogManager.refreshAskDialogData(state);
        }
        renderShortcuts(state);
    }

    private void renderQuiz(GenericGameState.PendingQuiz quiz) {
        quizHandler.renderQuiz(quiz);
    }

    private void refreshInfoLabel() {
        if (dialogManager.isDiscardDialogOpen() || dialogManager.isAskDialogOpen()) {
            dialogManager.refreshInfoLabelIfNeeded();
            return;
        }
        if (!quizHandler.isActive()) {
            if (exchangePending) {
                exchangeRenderer.refreshInfoLabel(exchangePending);
            } else {
                infoLabel.setText("");
            }
            return;
        }
        quizHandler.refreshInfoLabel();
    }

    private void renderActions(GenericGameState state) {
        actionsRenderer.render(state, exchangePending);
    }

    private void dispatchSelectedAction() {
        GenericGameState.GenericAction selected = actionsList.getSelectedValue();
        if (selected == null || selected.type() == null || selected.type().isBlank()) {
            emitter.announceError("Aucune action sélectionnée.");
            return;
        }
        if (blockIfBotTurn()) {
            return;
        }
        dispatchAction(selected);
    }

    private List<GenericGameState.GenericAction> availableActionsSnapshot() {
        List<GenericGameState.GenericAction> out = new ArrayList<>();
        for (int i = 0; i < actionsModel.size(); i++) {
            GenericGameState.GenericAction act = actionsModel.get(i);
            if (act != null) {
                out.add(act);
            }
        }
        return out;
    }

    private Map<String, Object> toPayload(Object payload) {
        if (payload == null) return Map.of();
        if (payload instanceof Map<?, ?> map) {
            Map<String, Object> safe = new LinkedHashMap<>();
            map.forEach((k, v) -> {
                if (k != null) {
                    safe.put(k.toString(), v);
                }
            });
            return safe;
        }
        if (payload instanceof JsonNode node) {
            return mapper.convertValue(node, Map.class);
        }
        try {
            return mapper.convertValue(payload, Map.class);
        } catch (IllegalArgumentException ex) {
            return Collections.emptyMap();
        }
    }

    private void renderPending(Object pending) {
        if (pending instanceof GenericGameState.PendingQuiz quiz && !isLocalQuiz(quiz)) {
            pendingLabel.setText("");
            return;
        }
        if (dialogManager.isAskDialogOpen()) {
            pendingLabel.setText(dialogManager.buildAskAnnouncementText());
            return;
        }
        GamePendingRenderer.Outcome outcome = pendingRenderer.render(
                pending,
                exchangePending,
                infoLabel.getText() != null && infoLabel.getText().startsWith("Quiz")
        );
        exchangePending = outcome.exchangePending();
        if (outcome.clearInfoLabelIfNotQuiz()) {
            infoLabel.setText("");
        }
        pendingLabel.setText(outcome.pendingLabel());
    }

    private void renderPlayerCollections(GenericGameState state) {
        if (state != null) {
            var resolved = playerCollectionsRenderer.resolve(state, localUserId, localUsername);
            if (resolved.isPresent()) {
                LOGGER.debug("Player collections resolved: playerId={}, localUserId={}, shopping={}, basket={}, inventory={}",
                        resolved.get().playerId(), localUserId, resolved.get().shopping().size(),
                        resolved.get().basket().size(), resolved.get().inventory().size());

                // Accepter la résolution même si le playerId ne correspond pas exactement
                // (le resolver a plusieurs stratégies: par ID, par username, premier non-bot)
                localPlayerId = resolved.get().playerId();
                quizHandler.setLocalPlayerId(localPlayerId);
                dialogManager.setLocalPlayerId(localPlayerId);
                updateCollectionsFromLists(resolved.get().shopping(), resolved.get().basket(), resolved.get().inventory());

                if (localUserId != null && resolved.get().playerId() != localUserId) {
                    LOGGER.info("Player ID resolved differently: resolved={}, expected localUserId={} (this is normal for some games)",
                            resolved.get().playerId(), localUserId);
                }
                return;
            } else {
                LOGGER.warn("Failed to resolve player collections for localUserId={}, localUsername={}", localUserId, localUsername);
            }
            localPlayerId = null;
            quizHandler.setLocalPlayerId(null);
            dialogManager.setLocalPlayerId(null);
            clearCollectionsView();
            return;
        }
        // Fallback: conserver la dernière vue connue (évite de vider si le serveur n'expose pas la vue joueur).
        shoppingLabel.setText("S : " + formatList(shoppingView));
        basketLabel.setText("B : " + formatList(basketView));
        inventoryLabel.setText("I : " + formatList(inventoryView));
    }

    private void announceResolvedCollection(String id) {
        if (localPlayerId == null) {
            LOGGER.warn("Cannot announce collection '{}': localPlayerId is null", id);
            return;
        }
        LOGGER.debug("Announcing collection '{}' for localPlayerId={}", id, localPlayerId);
        GenericGameState state = lastState;
        if (state == null || state.extras() == null || !state.extras().isObject()) {
            LOGGER.debug("Using fallback views for collection '{}'", id);
            if ("shopping".equals(id)) announcementService.announceCollection("shopping", shoppingView);
            else if ("basket".equals(id)) announcementService.announceCollection("basket", basketView);
            else if ("inventory".equals(id)) announcementService.announceCollection("inventory", inventoryView);
            return;
        }
        java.util.Optional<PlayerCollectionsViewModel.ResolvedView> resolved =
                playerCollectionsViewModel.resolveForPlayerId(state.extras(), localPlayerId);
        if (resolved.isPresent()) {
            java.util.List<String> values = switch (id) {
                case "shopping" -> resolved.get().shopping();
                case "basket" -> resolved.get().basket();
                case "inventory" -> resolved.get().inventory();
                default -> java.util.List.of();
            };
            LOGGER.debug("Announcing collection '{}' with {} items", id, values.size());
            announcementService.announceCollection(id, values);
            return;
        }
        LOGGER.warn("Failed to resolve collection '{}' from state extras, using fallback", id);
        if ("shopping".equals(id)) announcementService.announceCollection("shopping", shoppingView);
        else if ("basket".equals(id)) announcementService.announceCollection("basket", basketView);
        else if ("inventory".equals(id)) announcementService.announceCollection("inventory", inventoryView);
    }

    private void clearCollectionsView() {
        shoppingView = java.util.List.of();
        basketView = java.util.List.of();
        inventoryView = java.util.List.of();
        shoppingLabel.setText("S : ");
        basketLabel.setText("B : ");
        inventoryLabel.setText("I : ");
    }

    private void renderShortcuts(GenericGameState state) {
        if (state != null && state.pending() instanceof GenericGameState.PendingQuiz quiz && !isLocalQuiz(quiz)) {
            infoLabel.setText("");
        }

        // Ne pas écraser les raccourcis globaux de table (ex: b / Maj+b pour les bots) avant le démarrage.
        boolean allowDynamic = (tableState != null && tableState.started()) || isGameStarted(state);
        dynamicShortcuts = shortcutResolver.resolve(state, allowDynamic);
        rebindDynamicShortcuts();
        // Pas de shortcuts fournis ou partie non démarrée : nettoyer les bindings dynamiques.
    }

    private void rebindDynamicShortcuts() {
        if (windowMapRef == null || actionMapRef == null) return;
        if (shortcutBinder == null) {
            shortcutBinder = new GameShortcutBinder(windowMapRef, actionMapRef);
        }
        shortcutBinder.rebind(dynamicShortcuts, this::handleInterfaceShortcut, this::handleActionShortcut);
        // Raccourcis réservés au client : réappliquer après les bindings dynamiques.
        KeyboardEventRouter router = new KeyboardEventRouter(windowMapRef, actionMapRef);
        // Le raccourci X est géré au niveau "table" (RoomTableScreen) pour fonctionner quel que soit le focus.
    }

    private void handleResetShortcut() {
        if (resetHandler == null) {
            return;
        }
        if (!isTableStarted()) {
            return;
        }
        if (dialogManager != null && (dialogManager.isAskDialogOpen() || dialogManager.isDiscardDialogOpen())) {
            return;
        }
        boolean confirmed = GameResetDialog.confirm(this);
        if (!confirmed) {
            emitter.announceEvent("Réinitialisation annulée.");
            return;
        }
        emitter.announceEvent("Réinitialisation de la partie demandée.");
        resetHandler.run();
    }

    private boolean confirmResetGame() {
        java.awt.Window owner = SwingUtilities.getWindowAncestor(this);
        if (owner == null) {
            owner = javax.swing.JOptionPane.getFrameForComponent(this);
        }
        final boolean[] confirmed = {false};

        JDialog dialog = new JDialog(owner, "Réinitialiser la partie", java.awt.Dialog.ModalityType.APPLICATION_MODAL);
        dialog.setDefaultCloseOperation(JDialog.DISPOSE_ON_CLOSE);
        dialog.setResizable(false);
        dialog.setFocusTraversalKeysEnabled(false);
        dialog.getAccessibleContext().setAccessibleName("Réinitialiser la partie");
        dialog.getAccessibleContext().setAccessibleDescription("Confirmation de réinitialisation. Utilisez les flèches haut/bas ou Tab pour choisir Oui ou Non, puis Entrée.");

        JLabel label = new JLabel("<html>Réinitialiser la partie et revenir en préparation ?<br/><br/>Vous pourrez à nouveau ajouter/retirer des joueurs.</html>");
        javax.swing.JButton yes = new javax.swing.JButton("Oui");
        javax.swing.JButton no = new javax.swing.JButton("Non");
        label.getAccessibleContext().setAccessibleName("Confirmation");
        label.getAccessibleContext().setAccessibleDescription("Réinitialiser la partie et revenir en préparation. Vous pourrez à nouveau ajouter ou retirer des joueurs.");
        yes.getAccessibleContext().setAccessibleName("Oui");
        no.getAccessibleContext().setAccessibleName("Non");

        yes.addActionListener(e -> {
            confirmed[0] = true;
            dialog.dispose();
        });
        no.addActionListener(e -> dialog.dispose());

        javax.swing.JPanel buttons = new javax.swing.JPanel(new java.awt.FlowLayout(java.awt.FlowLayout.RIGHT, 8, 0));
        buttons.add(no);
        buttons.add(yes);

        javax.swing.JPanel content = new javax.swing.JPanel(new BorderLayout(8, 12));
        content.setBorder(javax.swing.BorderFactory.createEmptyBorder(12, 12, 12, 12));
        content.add(label, BorderLayout.CENTER);
        content.add(buttons, BorderLayout.SOUTH);
        dialog.setContentPane(content);
        dialog.getRootPane().setDefaultButton(yes);

        InputMap im = dialog.getRootPane().getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap am = dialog.getRootPane().getActionMap();
        Runnable focusYes = () -> {
            dialog.getRootPane().setDefaultButton(yes);
            yes.requestFocusInWindow();
        };
        Runnable focusNo = () -> {
            dialog.getRootPane().setDefaultButton(no);
            no.requestFocusInWindow();
        };
        am.put("reset.focus.next", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                KeyboardFocusManager.getCurrentKeyboardFocusManager().focusNextComponent();
            }
        });
        am.put("reset.focus.prev", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                KeyboardFocusManager.getCurrentKeyboardFocusManager().focusPreviousComponent();
            }
        });
        am.put("reset.choice.next", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (yes.isFocusOwner()) {
                    focusNo.run();
                } else {
                    focusYes.run();
                }
            }
        });
        am.put("reset.choice.prev", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (no.isFocusOwner()) {
                    focusYes.run();
                } else {
                    focusNo.run();
                }
            }
        });
        am.put("reset.cancel", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                dialog.dispose();
            }
        });
        im.put(KeyStroke.getKeyStroke("TAB"), "reset.focus.next");
        im.put(KeyStroke.getKeyStroke("shift TAB"), "reset.focus.prev");
        im.put(KeyStroke.getKeyStroke("UP"), "reset.choice.prev");
        im.put(KeyStroke.getKeyStroke("DOWN"), "reset.choice.next");
        im.put(KeyStroke.getKeyStroke("ESCAPE"), "reset.cancel");

        SwingUtilities.invokeLater(focusNo);
        dialog.pack();
        dialog.setLocationRelativeTo(owner);
        dialog.setVisible(true);
        return confirmed[0];
    }

    private void handleInterfaceShortcut(String id) {
        if (id == null || id.isBlank()) return;
        switch (id) {
            case "shopping" -> announceResolvedCollection("shopping");
            case "basket" -> announceResolvedCollection("basket");
            case "inventory" -> announceResolvedCollection("inventory");
            case "position" -> announcementService.announcePosition(lastState, localPlayerId != null ? localPlayerId : tableState.currentPlayerId());
            case "hand" -> announcementService.announceHand(lastState);
            case "books" -> announcementService.announceBooks(lastState);
            default -> {
                // noop
            }
        }
    }

    private java.util.List<GameDialogManager.PlayerOption> buildFallbackAskTargets() {
        java.util.ArrayList<GameDialogManager.PlayerOption> res = new java.util.ArrayList<>();
        Integer selfId = localPlayerId != null ? localPlayerId : localUserId;
        if (tableState != null) {
            for (var p : tableState.players()) {
                if (p == null || p.id() == null) continue;
                if (selfId != null && selfId.equals(p.id())) continue;
                String name = p.username() == null ? "" : p.username().trim();
                if (!name.isBlank()) res.add(new GameDialogManager.PlayerOption(p.id(), name));
            }
            for (var b : tableState.bots()) {
                if (b == null || b.id() == null) continue;
                if (selfId != null && selfId.equals(b.id())) continue;
                String name = b.name() == null ? "" : b.name().trim();
                if (!name.isBlank()) res.add(new GameDialogManager.PlayerOption(b.id(), name));
            }
        }
        return res;
    }

    private void ensureAskModal() {
        if (askModal != null) return;
        java.awt.Window owner = SwingUtilities.getWindowAncestor(this);
        if (owner == null) {
            owner = javax.swing.JOptionPane.getFrameForComponent(this);
        }
        askModal = new JDialog(owner, "Demande de carte", java.awt.Dialog.ModalityType.APPLICATION_MODAL);
        askModal.setDefaultCloseOperation(JDialog.DO_NOTHING_ON_CLOSE);
        askModal.setResizable(false);
        askModal.setFocusTraversalKeysEnabled(false);

        askModalLabel = new JLabel("");
        AccessibleDecorator.apply(askModalLabel, AccessibleSpec.builder()
                .name("Demande de carte")
                .description("Tabulation pour changer de champ, flèches pour choisir, Entrée pour valider, Échap pour annuler.")
                .build());
        focusHighlighter.apply(askModalLabel);
        disableFocusTraversalRecursively(askModalLabel);

        JPanel content = new JPanel(new BorderLayout(8, 8));
        content.setBorder(javax.swing.BorderFactory.createEmptyBorder(12, 12, 12, 12));
        content.add(askModalLabel, BorderLayout.CENTER);
        askModal.setContentPane(content);

        javax.swing.JRootPane root = askModal.getRootPane();
        InputMap im = root.getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        ActionMap am = root.getActionMap();
        KeyboardEventRouter router = new KeyboardEventRouter(im, am);
        router.bind("TAB", "ask.modal.tab", () -> {
            dialogManager.moveAskFocus(false);
            refreshAskModal(true, false);
        });
        router.bind("shift TAB", "ask.modal.tab.back", () -> {
            dialogManager.moveAskFocus(true);
            refreshAskModal(true, false);
        });
        router.bind("UP", "ask.modal.up", () -> {
            dialogManager.moveAskSelection(-1);
            refreshAskModal(false, true);
        });
        router.bind("DOWN", "ask.modal.down", () -> {
            dialogManager.moveAskSelection(1);
            refreshAskModal(false, true);
        });
        router.bind("ENTER", "ask.modal.enter", () -> {
            dialogManager.sendAskDialog();
            closeAskModal();
        });
        router.bind("ESCAPE", "ask.modal.escape", () -> {
            dialogManager.cancelAskDialog();
            closeAskModal();
        });
        router.bind("X", "ask.modal.reset", () -> {
            // Permettre la rÇ¸initialisation mÇ¦me quand la modale est ouverte (sinon l'utilisateur doit faire Echap puis X).
            dialogManager.cancelAskDialog();
            closeAskModal();
            if (quizHandler.submitIfActive()) return;
            handleResetShortcut();
        });
    }

    private void openAskModal() {
        ensureAskModal();
        refreshAskModal(true, false);
        askModal.pack();
        askModal.setLocationRelativeTo(SwingUtilities.getWindowAncestor(this));
        askModal.setVisible(true);
    }

    private void refreshAskModal(boolean announceFull, boolean announceSelection) {
        if (askModalLabel == null) return;
        String full = dialogManager.buildAskAnnouncementText();
        askModalLabel.setText(full);
        if (announceFull) {
            emitter.announceEvent(full);
        } else if (announceSelection) {
            String selection = dialogManager.buildAskSelectionAnnouncementText();
            if (selection != null && !selection.isBlank()) {
                emitter.announceEvent(selection);
            }
        }
    }

    private void closeAskModal() {
        if (askModal != null) {
            askModal.setVisible(false);
        }
    }

    private void handleActionShortcut(String targetType) {
        if (targetType == null || targetType.isBlank()) return;
        for (int i = 0; i < actionsModel.size(); i++) {
            GenericGameState.GenericAction act = actionsModel.get(i);
            if (act != null && targetType.equalsIgnoreCase(act.type())) {
                actionsList.setSelectedIndex(i);
                if ("ask_card".equalsIgnoreCase(targetType)) {
                    dialogManager.openAskDialog(lastState, buildFallbackAskTargets());
                    if (dialogManager.isAskDialogOpen()) {
                        openAskModal();
                    } else {
                        String reason = dialogManager.getLastAskBlockReason();
                        emitter.announceError("Impossible d'ouvrir la demande" + (reason.isBlank() ? "" : " : " + reason));
                    }
                    return;
                }
                dispatchAction(act);
                return;
            }
        }
        // Donne un retour immédiat si le raccourci est pressé mais que l'action n'est pas disponible (ex: pas ton tour).
        if ("ask_card".equalsIgnoreCase(targetType)) {
            emitter.announceError("Demande de carte indisponible (pas d'action serveur : pas votre tour ou partie non démarrée).");
        } else if ("discard_card".equalsIgnoreCase(targetType)) {
            emitter.announceError("Défausse indisponible (pas d'action serveur : pas votre tour ou rien à défausser).");
        } else if ("answer_ask_card_accept".equalsIgnoreCase(targetType)) {
            if (!isPendingAskForMe()) {
                emitter.announceError("Aucune demande de carte à accepter.");
                return;
            }
            String missing = resolveRequestedMemberIdFromPendingAsk();
            if (missing != null && !playerHasMemberInHand(missing)) {
                emitter.announceError("Impossible d'accepter : vous n'avez pas la carte demandée.");
            } else {
                emitter.announceError("Acceptation indisponible (le serveur ne propose pas l'action).");
            }
        } else if ("answer_ask_card_refuse".equalsIgnoreCase(targetType)) {
            if (!isPendingAskForMe()) {
                emitter.announceError("Aucune demande de carte à refuser.");
            } else {
                emitter.announceError("Refus indisponible (le serveur ne propose pas l'action).");
            }
        }
    }

    private String resolveRequestedMemberIdFromPendingAsk() {
        if (lastState == null || lastState.extras() == null || !lastState.extras().isObject()) return null;
        JsonNode pending = lastState.extras().path("pendingAsk");
        if (pending != null && pending.isObject()) {
            String memberId = pending.path("memberId").asText("");
            return memberId.isBlank() ? null : memberId;
        }
        return null;
    }

    private boolean playerHasMemberInHand(String memberId) {
        if (memberId == null || memberId.isBlank() || lastState == null || lastState.extras() == null || !lastState.extras().isObject()) {
            return false;
        }
        JsonNode handCards = lastState.extras().path("handCards");
        if (handCards != null && handCards.isArray()) {
            for (JsonNode c : handCards) {
                if (c != null && c.isObject() && memberId.equalsIgnoreCase(c.path("memberId").asText(""))) {
                    return true;
                }
            }
        }
        return false;
    }

    private String formatList(Object raw) {
        if (raw == null) return "-";
        if (raw instanceof java.util.List<?> list) {
            if (list.isEmpty()) return "-";
            return String.join(", ", list.stream().map(v -> v == null ? "" : v.toString()).filter(s -> !s.isBlank()).toList());
        }
        if (raw instanceof JsonNode node && node.isArray()) {
            java.util.List<String> vals = new java.util.ArrayList<>();
            node.forEach(n -> {
                if (n != null && !n.asText("").isBlank()) {
                    vals.add(n.asText(""));
                }
            });
            return vals.isEmpty() ? "-" : String.join(", ", vals);
        }
        return raw.toString();
    }

    private void announceCollection(String id, java.util.List<String> values) {
        announcementService.announceCollection(id, values);
    }

    private void announcePosition() {
        PositionAnnouncementFormatter positionAnnouncementFormatter = new PositionAnnouncementFormatter();
        Integer currentId = tableState.currentPlayerId();
        int turn = tableState.turnRound();
        // Les positions par joueur sont dans extras.board.positions si exposé, sinon annoncer juste le tour.
        GenericGameState state = lastState;
        JsonNode boardNode = state == null ? null : state.board();
        String message = null;
        if (boardNode != null && boardNode.has("positions") && boardNode.get("positions").isObject() && currentId != null) {
            JsonNode pos = boardNode.get("positions").get(String.valueOf(currentId));
            if (pos != null && pos.isInt() && boardNode.has("tiles") && boardNode.get("tiles").isArray()) {
                int index = pos.asInt();
                int total = boardNode.get("tiles").size();
                message = positionAnnouncementFormatter.formatPosition(index, total, turn);
            }
        }
        if (message == null) {
            message = positionAnnouncementFormatter.formatPosition(-1, 0, turn);
        }
        emitter.announceEvent(message);
    }

    private void announceHand() {
        announcementService.announceHand(lastState);
    }

    private void announceBooks() {
        announcementService.announceBooks(lastState);
    }

    private void updateCollectionsFromLists(java.util.List<String> shopping, java.util.List<String> basket, java.util.List<String> inventory) {
        if (shopping != null) {
            lastSelfShopping = shopping;
        }
        if (basket != null) {
            lastSelfBasket = basket;
        }
        if (inventory != null) {
            lastSelfInventory = inventory;
        }
        shoppingView = lastSelfShopping;
        basketView = lastSelfBasket;
        inventoryView = lastSelfInventory;
        shoppingLabel.setText("S : " + formatList(shoppingView));
        basketLabel.setText("B : " + formatList(basketView));
        inventoryLabel.setText("I : " + formatList(inventoryView));
    }

    private String normalizeName(String name) {
        return name == null ? null : name.trim().toLowerCase();
    }

    private Integer decodeUserIdFromToken(String token) {
        if (token == null || token.isBlank()) return null;
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) return null;
            String payload = new String(Base64.getUrlDecoder().decode(parts[1]));
            JsonNode node = mapper.readTree(payload);
            if (node.has("id") && node.get("id").isInt()) {
                return node.get("id").asInt();
            }
            if (node.has("userId") && node.get("userId").isInt()) {
                return node.get("userId").asInt();
            }
        } catch (Exception ex) {
            LOGGER.debug("[token] decode failed: {}", ex.getMessage());
        }
        return null;
    }

    private boolean blockIfBotTurn() {
        return botTurnGate.shouldBlock(tableState.started(), botTurnLockTracker.locked(), quizHandler.isActive(), isPendingAskForMe());
    }

    private boolean isPendingAskForMe() {
        Object pending = lastState != null ? lastState.pending() : null;
        if (pending == null || localPlayerId == null) return false;
        if (pending instanceof com.lemondelila.client.game.core.model.GenericGameState.PendingGeneric gen) {
            if ("ask_card".equalsIgnoreCase(gen.type())) {
                Integer targetId = gen.targetPlayerId();
                return targetId != null && targetId.equals(localPlayerId);
            }
        } else if (pending instanceof JsonNode node) {
            if ("ask_card".equalsIgnoreCase(node.path("type").asText(""))) {
                if (node.path("targetPlayerId").isInt() && node.get("targetPlayerId").asInt() == localPlayerId) {
                    return true;
                }
            }
        }
        return false;
    }

    private void announceStats() {
        // Ne pas polluer l'UX avant le démarrage (les raccourcis dynamiques ne sont pas encore actifs).
        if (!isTableStarted()) {
            return;
        }
        // Les statistiques "pollution/familles" sont spécifiques à Dame Nature.
        if (!isDameNature(lastState)) {
            return;
        }
        announcementService.announceStats(lastState);
    }

    private static boolean isDameNature(GenericGameState state) {
        if (state == null || state.metadata() == null || !state.metadata().isObject()) {
            return false;
        }
        String gameType = state.metadata().path("gameType").asText("");
        return "dame-nature".equalsIgnoreCase(gameType);
    }

    private static String simplifyDiscardAnnouncement(GenericGameState state, String text) {
        if (!isDameNature(state) || text == null || text.isBlank()) {
            return text;
        }
        int colon = text.indexOf(':');
        if (colon < 0 || colon + 1 >= text.length()) {
            return text;
        }
        String rawLabel = text.substring(colon + 1).trim();
        int paren = rawLabel.indexOf(" (");
        if (paren > 0) {
            rawLabel = rawLabel.substring(0, paren).trim();
        }
        String simplified = simplifyFamilyCardLabel(rawLabel);
        return simplified.isBlank() ? text : simplified;
    }

    private static String simplifyFamilyCardLabel(String label) {
        if (label == null || label.isBlank()) {
            return "";
        }
        // Format attendu (Dame Nature) : "Famille des Poissons - Poisson-clown"
        String[] parts = label.split("\\s+-\\s+", 2);
        if (parts.length != 2) {
            return label;
        }
        String left = parts[0].trim();
        String right = parts[1].trim();
        if (left.isBlank() || right.isBlank()) {
            return label;
        }
        if (!left.toLowerCase(Locale.ROOT).startsWith("famille")) {
            return label;
        }
        String family = left
                .replaceFirst("(?i)^famille\\s+des\\s+", "")
                .replaceFirst("(?i)^famille\\s+de\\s+la\\s+", "")
                .replaceFirst("(?i)^famille\\s+du\\s+", "")
                .replaceFirst("(?i)^famille\\s+de\\s+l['’]\\s*", "")
                .replaceFirst("(?i)^famille\\s+de\\s+", "")
                .trim();
        if (family.isBlank()) {
            return label;
        }
        return right + " (" + family.toLowerCase(Locale.ROOT) + ")";
    }

    @Override
    public void triggerPrimaryAction() {
        if (blockIfBotTurn()) {
            return;
        }
        if (exchangeActive) {
            emitter.announceError("Terminez l'échange en cours avant de relancer le dé.");
            return;
        }
        if (quizHandler.submitIfActive()) {
            return;
        }
        if (!isTableStarted()) {
            if (startHandler != null) {
                if (!controller.hasEnoughParticipants()) {
                    // Participants parfois pas encore synchronisés localement (ex : bot ajouté juste avant).
                    // On tente quand même le démarrage et on laisse le serveur valider.
                    emitter.announceError(controller.participantRequirementMessage());
                }
                controller.markStartPending();
                startHandler.run();
            }
            // Auto-trigger primary action after starting
            if (primaryAction != null && autoPrimaryAfterStart) {
                controller.triggerPrimaryAction();
            }
            return;
        }
        if (primaryAction != null) {
            controller.triggerPrimaryAction();
        } else {
            triggerSelectedAction();
        }
    }

    private void triggerSelectedAction() {
        GenericGameState.GenericAction selected = actionsList.getSelectedValue();
        if (selected == null && actionsModel.getSize() > 0) {
            actionsList.setSelectedIndex(0);
            selected = actionsList.getSelectedValue();
        }
        if (selected == null) return;
        dispatchAction(selected);
    }

    private boolean dispatchAction(GenericGameState.GenericAction action) {
        if (action == null || action.type() == null || action.type().isBlank()) {
            return false;
        }
        if ("ask_card".equalsIgnoreCase(action.type())) {
            dialogManager.openAskDialog(lastState, buildFallbackAskTargets());
            if (dialogManager.isAskDialogOpen()) {
                openAskModal();
            } else {
                String reason = dialogManager.getLastAskBlockReason();
                emitter.announceError("Impossible d'ouvrir la demande" + (reason.isBlank() ? "" : " : " + reason));
            }
            return true;
        }
        if (blockIfBotTurn()) {
            // Exception : si une demande de carte est en attente pour moi, autoriser la réponse.
            if ("answer_ask_card_accept".equalsIgnoreCase(action.type()) || "answer_ask_card_refuse".equalsIgnoreCase(action.type())) {
                if (!isPendingAskForMe()) return false;
            } else {
                return false;
            }
        }
        Map<String, Object> payload = toPayload(action.payload());
        controller.sendActions(List.of(ActionRequest.of(action.type(), payload)));
        LOGGER.debug("[shortcut] action envoyee type={} payloadKeys={}", action.type(), payload.keySet());
        return true;
    }

    private void handleDrawShortcut() {
        LOGGER.debug("[shortcut] espace pressed actions={}", describeActions());
        if (quizHandler.isActive()) {
            // En mode quiz, on ignore Espace pour ne pas envoyer d'action parasite.
            return;
        }
        if (blockIfBotTurn()) {
            return;
        }
        if (!isTableStarted()) {
            return; // Pas de pioche avant le dンmarrage de la partie.
        }
        if (!hasActionMatching(GameActionUtils::isDrawAction)) {
            emitter.announceError("Aucune pioche possible pour le moment.");
            return;
        }
        dispatchActionMatching(GameActionUtils::isDrawAction);
    }

    private void handleRollShortcut() {
        LOGGER.debug("[shortcut] entree pressed actions={}", describeActions());
        if (quizHandler.submitIfActive()) {
            return;
        }
        // Si un mini-dialogue est ouvert, Entrée valide la sélection.
        if (dialogManager.isAskDialogOpen()) {
            dialogManager.sendAskDialog();
            return;
        }
        if (dialogManager.isDiscardDialogOpen()) {
            dialogManager.sendDiscardSelection();
            return;
        }
        if (blockIfBotTurn()) {
            return;
        }
        // Si la partie n'est pas lancee, utiliser le comportement de demarrage (equivalent bouton Start).
        if (!isTableStarted()) {
            if (primaryAction != null) {
                triggerPrimaryAction();
                return;
            }
            // Toujours tenter un démarrage explicite (évite le blocage si le client sous-estime les participants).
            if (startHandler != null) {
                controller.markStartPending();
                startHandler.run();
                return;
            }
            dispatchFirstAvailable();
            return;
        }
        // En partie : ouvrir la sélection de défausse si disponible, sinon lancer/défausser/actions.
        if (hasActionMatching(GameActionUtils::isDiscardAction)) {
            dialogManager.handleDiscardShortcut();
            if (dialogManager.isDiscardDialogOpen()) {
                emitter.announceEvent(simplifyDiscardAnnouncement(lastState, dialogManager.buildDiscardAnnouncementText()));
            }
            return;
        }
        if (dispatchActionMatching(GameActionUtils::isDiceAction)) {
            return;
        }
        if (dispatchActionMatching(GameActionUtils::isDiscardAction)) {
            return;
        }
        triggerSelectedAction();
    }

    private boolean isTableStarted() {
        if (tableState != null && tableState.started()) {
            return true;
        }
        return isGameStarted(lastState);
    }

    private boolean isGameStarted(GenericGameState state) {
        if (state == null || state.status() == null) {
            return false;
        }
        String normalized = state.status().trim().toLowerCase(java.util.Locale.ROOT);
        if (normalized.isBlank()) {
            return false;
        }
        return !("open".equals(normalized)
                || "setup".equals(normalized)
                || "ouvert".equals(normalized)
                || "preparing".equals(normalized)
                || "pending".equals(normalized));
    }

    private void sendAskAnswer(boolean accept) {
        if (localPlayerId == null) return;
        // Ne rien envoyer si aucune demande ne cible le joueur.
        if (!isPendingAskForMe()) return;
        String type = accept ? "answer_ask_card_accept" : "answer_ask_card_refuse";
        Map<String, Object> requiredPayload = Map.of("playerId", localPlayerId);
        var maybeAction = AvailableActionMatcher.findFirstMatching(
                availableActionsSnapshot(),
                type,
                requiredPayload,
                this::toPayload
        );
        if (maybeAction.isEmpty()) {
            // fallback: certains serveurs exposent un payload vide, on accepte si l'action existe au moins par type
            maybeAction = AvailableActionMatcher.findFirstMatching(
                    availableActionsSnapshot(),
                    type,
                    Map.of(),
                    this::toPayload
            );
        }
        if (maybeAction.isEmpty()) {
            emitter.announceError("Action réponse indisponible (pas d'action serveur correspondante).");
            return;
        }
        dispatchAction(maybeAction.get());
    }

    private boolean dispatchActionMatching(java.util.function.Predicate<GenericGameState.GenericAction> matcher) {
        for (int i = 0; i < actionsModel.size(); i++) {
            GenericGameState.GenericAction act = actionsModel.get(i);
            if (act == null) continue;
            if (matcher.test(act)) {
                actionsList.setSelectedIndex(i);
                return dispatchAction(act);
            }
        }
        return false;
    }

    private boolean hasActionMatching(java.util.function.Predicate<GenericGameState.GenericAction> matcher) {
        for (int i = 0; i < actionsModel.size(); i++) {
            GenericGameState.GenericAction act = actionsModel.get(i);
            if (act == null) continue;
            if (matcher.test(act)) {
                return true;
            }
        }
        return false;
    }

    private boolean dispatchFirstAvailable() {
        if (actionsModel.isEmpty()) return false;
        GenericGameState.GenericAction first = actionsModel.get(0);
        return dispatchAction(first);
    }

    private String describeActions() {
        return GameActionUtils.describeActions(actionsModel);
    }

    private void syncTableState(GenericGameState state) {
        if (state == null) {
            return;
        }
        if (state.players() == null || !state.players().isArray()) {
            return;
        }
        RoomParticipantsMapper.updateFromPlayers(tableState, state.players());
    }

    private void refreshExchangeInfoLabel() {
        exchangeRenderer.refreshInfoLabel(exchangePending);
    }

    private void announceExchangeSelectionIfNeeded(int index) {
        exchangeRenderer.announceSelectionIfNeeded(index, exchangePending);
    }

    private String sanitizeLogLine(String line) {
        return announcementFormatter.sanitizeLogLine(line);
    }

    private boolean isLocalQuiz(GenericGameState.PendingQuiz quiz) {
        if (quiz == null) {
            return false;
        }
        Integer quizPlayerId = quiz.playerId();
        if (quizPlayerId == null) {
            return false;
        }
        return localPlayerId != null && localPlayerId.equals(quizPlayerId);
    }
}
