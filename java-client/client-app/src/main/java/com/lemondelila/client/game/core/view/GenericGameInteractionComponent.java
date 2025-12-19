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
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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
    private static final String CARD_DEFAULT = "card.default";
    private static final String CARD_EXCHANGE = "card.exchange";
    private final JPanel cardContainer = new JPanel(new CardLayout());
    private JComponent exchangeCard;
    private boolean exchangeActive;

    public GenericGameInteractionComponent(GenericGameInteractionController controller,
                                           GameActionEmitter emitter,
                                           GameHistoryController history,
                                           TableState tableState,
                                           TurnController turnController,
                                           FocusHighlighter focusHighlighter,
                                           Optional<GameQuizComponentFactory> quizFactory,
                                           PrimaryActionDescriptor primaryAction,
                                           Runnable startHandler,
                                           boolean autoPrimaryAfterStart) {
        super(new BorderLayout(8, 8));
        setFocusable(true);
        this.controller = Objects.requireNonNull(controller, "controller");
        this.emitter = Objects.requireNonNull(emitter, "emitter");
        this.history = Objects.requireNonNull(history, "history");
        this.tableState = Objects.requireNonNull(tableState, "tableState");
        this.announcementService = new GameAnnouncementService(this.tableState, msg -> this.emitter.announceEvent(msg));
        this.primaryAction = primaryAction;
        this.startHandler = startHandler;
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
        buildUi(focusHighlighter);
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
        javax.swing.JLabel shortcutsLabel = new javax.swing.JLabel("Raccourcis : [Espace] piocher, [Entrée] lancer/valider");
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
        router.bind("S", "stats.show", () -> announcementService.announceStats(lastState));
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
        if (dialogManager.isDiscardDialogOpen()) {
            dialogManager.moveDiscardSelection(delta);
            return;
        }
        if (!quizHandler.isActive()) {
            // Pas de quiz actif : on recycle la navigation pour les échanges si besoin.
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
        requestFocusInWindow();
        controller.attach(roomId, this);
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
                localPlayerId = resolved.get().playerId();
                updateCollectionsFromLists(resolved.get().shopping(), resolved.get().basket(), resolved.get().inventory());
                return;
            }
        }
        // Fallback: conserver la dernière vue connue (évite de vider si le serveur n'expose pas la vue joueur).
        shoppingLabel.setText("S : " + formatList(shoppingView));
        basketLabel.setText("B : " + formatList(basketView));
        inventoryLabel.setText("I : " + formatList(inventoryView));
    }

    private void renderShortcuts(GenericGameState state) {
        if (state != null && state.pending() instanceof GenericGameState.PendingQuiz quiz && !isLocalQuiz(quiz)) {
            infoLabel.setText("");
        }

        // Ne pas écraser les raccourcis globaux de table (ex: b / Maj+b pour les bots) avant le démarrage.
        boolean allowDynamic = tableState != null && tableState.started();
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
    }

    private void handleInterfaceShortcut(String id) {
        if (id == null || id.isBlank()) return;
        switch (id) {
            case "shopping" -> announcementService.announceCollection("shopping", shoppingView);
            case "basket" -> announcementService.announceCollection("basket", basketView);
            case "inventory" -> announcementService.announceCollection("inventory", inventoryView);
            case "position" -> announcementService.announcePosition(lastState);
            case "hand" -> announcementService.announceHand(lastState);
            case "books" -> announcementService.announceBooks(lastState);
            default -> {
                // noop
            }
        }
    }

    private void handleActionShortcut(String targetType) {
        if (targetType == null || targetType.isBlank()) return;
        for (int i = 0; i < actionsModel.size(); i++) {
            GenericGameState.GenericAction act = actionsModel.get(i);
            if (act != null && targetType.equalsIgnoreCase(act.type())) {
                actionsList.setSelectedIndex(i);
                if ("ask_card".equalsIgnoreCase(targetType)) {
                    dialogManager.openAskDialog(lastState);
                    return;
                }
                dispatchAction(act);
                return;
            }
        }
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
        announcementService.announceStats(lastState);
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
        if (!tableState.started()) {
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
        if (selected == null) return;
        dispatchAction(selected);
    }

    private boolean dispatchAction(GenericGameState.GenericAction action) {
        if (action == null || action.type() == null || action.type().isBlank()) {
            return false;
        }
        if ("ask_card".equalsIgnoreCase(action.type())) {
            dialogManager.openAskDialog(lastState);
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
        if (!tableState.started()) {
            return; // Pas de pioche avant le dンmarrage de la partie.
        }
        if (hasActionMatching(GameActionUtils::isDrawAction)) {
            dispatchActionMatching(GameActionUtils::isDrawAction);
        }
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
        if (!tableState.started()) {
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
