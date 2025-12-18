package com.lemondelila.client.game.core.view;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.game.core.controller.GenericGameInteractionController;
import com.lemondelila.client.game.core.model.ActionRequest;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.model.PrimaryActionDescriptor;
import com.lemondelila.client.game.core.viewmodel.AvailableActionMatcher;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.service.GameActionEmitter;
import com.lemondelila.client.game.quiz.view.GameQuizComponent;
import com.lemondelila.client.game.quiz.view.GameQuizComponentFactory;
import com.lemondelila.client.game.quiz.view.GameQuizPanel;
import com.lemondelila.client.game.core.viewmodel.GameAnnouncementFormatter;
import com.lemondelila.client.game.core.viewmodel.GameExchangeNavigator;
import com.lemondelila.client.game.core.viewmodel.GameInfoLabelFormatter;
import com.lemondelila.client.game.core.viewmodel.GameLogTracker;
import com.lemondelila.client.game.core.viewmodel.GameShortcutBinder;
import com.lemondelila.client.game.core.viewmodel.PendingActionSelector;
import com.lemondelila.client.game.core.viewmodel.BotTurnGate;
import com.lemondelila.client.game.core.viewmodel.PendingViewModel;
import com.lemondelila.client.game.core.viewmodel.PlayerCollectionsViewModel;
import com.lemondelila.client.game.core.viewmodel.TurnAnnouncementTracker;
import com.lemondelila.client.game.core.viewmodel.CollectionAnnouncementFormatter;
import com.lemondelila.client.game.core.viewmodel.PositionAnnouncementFormatter;
import com.lemondelila.client.game.core.viewmodel.ListAnnouncementFormatter;
import com.lemondelila.client.game.core.viewmodel.StatsAnnouncementFormatter;
import com.lemondelila.client.game.core.viewmodel.GameActionUtils;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.room.service.RoomParticipantsMapper;
import com.lemondelila.client.game.turn.controller.TurnController;
import com.lemondelila.client.game.turn.model.TurnState;
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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.IntStream;
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
    private final GameLogTracker logTracker = new GameLogTracker(announcementFormatter);
    private final GameInfoLabelFormatter infoLabelFormatter = new GameInfoLabelFormatter();
    private final GameExchangeNavigator exchangeNavigator = new GameExchangeNavigator();
    private final PendingActionSelector pendingActionSelector = new PendingActionSelector();
    private final BotTurnGate botTurnGate = new BotTurnGate();
    private final PendingViewModel pendingViewModel = new PendingViewModel();
    private final PlayerCollectionsViewModel playerCollectionsViewModel = new PlayerCollectionsViewModel();
    private final TurnAnnouncementTracker turnAnnouncementTracker = new TurnAnnouncementTracker();
    private final CollectionAnnouncementFormatter collectionAnnouncementFormatter = new CollectionAnnouncementFormatter();
    private final PositionAnnouncementFormatter positionAnnouncementFormatter = new PositionAnnouncementFormatter();
    private final ListAnnouncementFormatter listAnnouncementFormatter = new ListAnnouncementFormatter();
    private final StatsAnnouncementFormatter statsAnnouncementFormatter = new StatsAnnouncementFormatter();
    private final JLabel infoLabel = new JLabel();
    private final JLabel pendingLabel = new JLabel();
    private final JLabel shoppingLabel = new JLabel();
    private final JLabel basketLabel = new JLabel();
    private final JLabel inventoryLabel = new JLabel();
    private final String localUsername;
    private final Integer localUserId;
    private Integer localPlayerId;
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
    // Dialog ask_card
    private boolean askDialogOpen = false;
    private int askTargetIndex = 0;
    private int askCardIndex = 0;
    private int askGiveIndex = 0;
    private int askFocusIndex = 0;
    private int discardIndex = 0;
    private List<PlayerOption> askTargets = List.of();
    private List<AskCardOption> askCards = List.of();
    private List<AskCardOption> giveCards = List.of();
    private List<AskCardOption> discardOptions = List.of();
    private Integer lastRollSeen;
    private int lastAnnouncedQuizChoice = -1;
    private String lastQuizAnnouncementKey;
    private boolean exchangePending;
    private boolean gameStarted;
    private boolean startAnnounced;
    private boolean firstStateRendered;
    private boolean pregameAnnounced;
    private boolean autoPrimaryDispatched;
    private boolean botTurnLocked;
    private boolean botLockNotified;
    private boolean discardDialogOpen;
    private Integer lastAnnouncedPlayerId;
    private Integer lastTurnIndexSeen;
    private GenericGameState.PendingQuiz activeQuiz;
    private int quizChoiceIndex = -1;
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
        this.primaryAction = primaryAction;
        this.startHandler = startHandler;
        this.autoPrimaryAfterStart = autoPrimaryAfterStart;
        this.turnController = Objects.requireNonNull(turnController, "turnController");
        var session = EncryptedSessionVault.defaultVault().load();
        this.localUsername = session.map(EncryptedSessionVault.SessionRecord::username).orElse(null);
        this.localUserId = decodeUserIdFromToken(session.map(EncryptedSessionVault.SessionRecord::token).orElse(null));
        this.localPlayerId = null;
        this.statusPanel = new GameStatusPanel(focusHighlighter);
        if (quizFactory != null && quizFactory.isPresent()) {
            this.quizComponent = quizFactory.get().create(focusHighlighter);
        } else {
            // Fallback simple pour s'assurer que le quiz s'affiche mÃªme si aucune fabrique n'est injectÃ©e.
            this.quizComponent = new GameQuizPanel(focusHighlighter);
        }
        buildUi(focusHighlighter);
        this.statusPanel.clear();
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
        listMap.put(KeyStroke.getKeyStroke("ENTER"), "actions.trigger");
        listActions.put("actions.trigger", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (submitIfQuizActive()) {
                    return;
                }
                dispatchSelectedAction();
            }
        });

        javax.swing.InputMap windowMap = getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        javax.swing.ActionMap actions = getActionMap();
        this.windowMapRef = windowMap;
        this.actionMapRef = actions;
        this.shortcutBinder = new GameShortcutBinder(windowMap, actions);
        windowMap.put(javax.swing.KeyStroke.getKeyStroke("ENTER"), "shortcut.roll-or-primary");
        actions.put("shortcut.roll-or-primary", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                handleRollShortcut();
            }
        });
        windowMap.put(javax.swing.KeyStroke.getKeyStroke("SPACE"), "shortcut.draw");
        actions.put("shortcut.draw", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                if (submitIfQuizActive()) return;
                handleDrawShortcut();
            }
        });
        // Demande de carte : navigation du mini-dialogue
        windowMap.put(javax.swing.KeyStroke.getKeyStroke("TAB"), "ask.tab");
        actions.put("ask.tab", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                if (askDialogOpen) {
                    moveAskFocus(false);
                }
            }
        });
        windowMap.put(javax.swing.KeyStroke.getKeyStroke("shift TAB"), "ask.tab.back");
        actions.put("ask.tab.back", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                if (askDialogOpen) {
                    moveAskFocus(true);
                }
            }
        });
        windowMap.put(javax.swing.KeyStroke.getKeyStroke("LEFT"), "ask.prev");
        windowMap.put(javax.swing.KeyStroke.getKeyStroke("RIGHT"), "ask.next");
        actions.put("ask.prev", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                if (askDialogOpen) {
                    moveAskSelection(-1);
                }
            }
        });
        actions.put("ask.next", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                if (askDialogOpen) {
                    moveAskSelection(1);
                }
            }
        });
        windowMap.put(javax.swing.KeyStroke.getKeyStroke("ESCAPE"), "ask.cancel");
        actions.put("ask.cancel", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                if (askDialogOpen) {
                    cancelAskDialog();
                }
                if (discardDialogOpen) {
                    cancelDiscardDialog();
                }
            }
        });

        // Statistiques rapides : touche S
        windowMap.put(javax.swing.KeyStroke.getKeyStroke("S"), "stats.show");
        actions.put("stats.show", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                announceStats();
            }
        });
        windowMap.put(javax.swing.KeyStroke.getKeyStroke("A"), "ask.answer.accept");
        windowMap.put(javax.swing.KeyStroke.getKeyStroke("R"), "ask.answer.refuse");
        actions.put("ask.answer.accept", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                sendAskAnswer(true);
            }
        });
        actions.put("ask.answer.refuse", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                sendAskAnswer(false);
            }
        });
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
        if (discardDialogOpen) {
            moveDiscardSelection(delta);
            return;
        }
        if ((activeQuiz == null || activeQuiz.choices().isEmpty() || quizComponent == null)) {
            // Pas de quiz actif : on recycle la navigation pour les échanges si besoin.
            handleExchangeNavigation(delta);
            return;
        }
        int size = activeQuiz.choices().size();
        int next = quizChoiceIndex;
        if (next < 0) {
            next = 0;
        } else {
            next = (next + delta) % size;
            if (next < 0) {
                next += size;
            }
        }
        quizChoiceIndex = next;
        updateQuizHighlight();
    }

    private void handleQuizAnswerShortcut(int index) {
        if (activeQuiz == null || activeQuiz.choices().isEmpty()) {
            return;
        }
        if (index < 0 || index >= activeQuiz.choices().size()) {
            return;
        }
        quizChoiceIndex = index;
        updateQuizHighlight();
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
        logTracker.reset();
        startAnnounced = false;
        firstStateRendered = false;
        pregameAnnounced = false;
        autoPrimaryDispatched = false;
        botTurnLocked = false;
        botLockNotified = false;
        discardDialogOpen = false;
        discardIndex = 0;
        lastAnnouncedPlayerId = null;
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
            statusPanel.clear();
            lastAnnouncedPlayerId = null;
            logTracker.reset();
        });
    }

    private void renderState(GenericGameState state) {
        statusPanel.update(state.status(), state.phase(), state.round(), state.turnIndex(), state.lastRoll());
        boolean startedFlag = "started".equalsIgnoreCase(state.status());
        boolean wasStarted = gameStarted;
        gameStarted = startedFlag;
        tableState.updateStatus(state.status());
        // Synchroniser participants avant de traiter le tour pour disposer de l'ordre correct.
        syncTableState(state);

        if (!firstStateRendered) {
            firstStateRendered = true;
            startAnnounced = startedFlag;
            pregameAnnounced = false;
        } else if (startedFlag && !wasStarted && !startAnnounced) {
            tableState.markStarted();
            emitter.announceEvent("La partie vient de démarrer, bon jeu !");
            startAnnounced = true;
            pregameAnnounced = false;
            if (autoPrimaryAfterStart && !autoPrimaryDispatched && primaryAction != null) {
                autoPrimaryDispatched = true;
                controller.triggerPrimaryAction();
            }
        } else if (!startedFlag) {
            startAnnounced = false;
            // ne pas réinitialiser pregameAnnounced pour éviter les répétitions avant le démarrage
            autoPrimaryDispatched = false;
        }
        renderLogs(state.logs());
        renderTurn(state);
        renderPlayerCollections(state);
        updateBotTurnLock(state);
        renderQuiz(state.pendingQuiz());
        renderPending(state.pending());
        renderActions(state);
        if (askDialogOpen) {
            refreshAskDialogData(state);
        }
        renderShortcuts(state);
    }

    private void renderLogs(List<String> logs) {
        for (String announcement : logTracker.consumeNewAnnouncements(logs, tableState.started())) {
            emitter.announceEvent(announcement);
        }
    }

    private void renderQuiz(GenericGameState.PendingQuiz quiz) {
        if (!isLocalQuiz(quiz)) {
            // Quiz pour un autre joueur ou un bot : on le montre dans les logs mais pas comme quiz interactif.
            activeQuiz = null;
            quizChoiceIndex = -1;
            lastAnnouncedQuizChoice = -1;
            lastQuizAnnouncementKey = null;
            exchangePending = false;
            if (quizComponent != null) {
                quizComponent.clearQuiz();
                updateQuizHighlight();
            }
            return;
        }

        if (quizComponent == null) {
            return;
        }
        if (quiz == null || !isLocalQuiz(quiz)) {
            activeQuiz = null;
            quizChoiceIndex = -1;
            lastAnnouncedQuizChoice = -1;
            lastQuizAnnouncementKey = null;
            exchangePending = false;
            quizComponent.clearQuiz();
            updateQuizHighlight();
            return;
        }
        LOGGER.debug("[quiz] render question={} choices={}", quiz.question(), quiz.choices());
        String quizKey = quiz.question() + "|" + String.join("||", quiz.choices());
        boolean sameQuiz = quizKey.equals(lastQuizAnnouncementKey);
        lastQuizAnnouncementKey = quizKey;
        activeQuiz = quiz;
        quizChoiceIndex = -1;
        if (!sameQuiz) {
            lastAnnouncedQuizChoice = -1;
        }
        exchangePending = false;
        quizComponent.showQuiz(quiz.question(), quiz.choices());
        if (!sameQuiz) {
            // Annonce vocale compl?te pour les lecteurs d'?cran (question + options).
            emitter.announceEvent(buildQuizAnnouncement(quiz.question(), quiz.choices()));
            infoLabel.setText(buildQuizChoicesLabel(quiz.question(), quiz.choices()));
        }
        // Forcer le rafraichissement visuel du panneau quiz.
        JComponent quizUi = quizComponent.getComponent();
        quizUi.setVisible(true);
        quizUi.revalidate();
        quizUi.repaint();
        updateQuizHighlight();
    }

    private void updateQuizHighlight() {
        if (quizComponent == null) {
            return;
        }
        if (activeQuiz == null || activeQuiz.choices().isEmpty()) {
            quizChoiceIndex = -1;
            quizComponent.highlightChoice(-1);
            refreshInfoLabel();
            return;
        }
        if (quizChoiceIndex < 0 || quizChoiceIndex >= activeQuiz.choices().size()) {
            quizChoiceIndex = 0;
        }
        quizComponent.highlightChoice(quizChoiceIndex);
        announceQuizSelectionIfNeeded();
        refreshInfoLabel();
    }

    private void refreshInfoLabel() {
        if (discardDialogOpen) {
            infoLabel.setText(infoLabelFormatter.formatDiscardLabel(
                    discardOptions.stream().map(AskCardOption::label).toList(),
                    discardIndex
            ));
            return;
        }
        if (askDialogOpen) {
            infoLabel.setText(infoLabelFormatter.formatAskLabel(
                    askDialogOpen,
                    askTargets.stream().map(PlayerOption::name).toList(),
                    askTargetIndex,
                    askCards.stream().map(AskCardOption::label).toList(),
                    askCardIndex,
                    giveCards.stream().map(AskCardOption::label).toList(),
                    askGiveIndex,
                    askFocusIndex
            ));
            return;
        }
        if (activeQuiz == null) {
            if (exchangePending) {
                refreshExchangeInfoLabel();
            } else {
                infoLabel.setText("");
            }
            return;
        }
        infoLabel.setText(infoLabelFormatter.formatQuizInfoLabel(activeQuiz.question(), activeQuiz.choices(), quizChoiceIndex));
    }

    private boolean submitIfQuizActive() {
        if (activeQuiz == null) {
            return false;
        }
        submitQuizAnswer();
        return true;
    }

    private void submitQuizAnswer() {
        if (activeQuiz == null || activeQuiz.choices().isEmpty()) {
            return;
        }
        if (quizChoiceIndex < 0 || quizChoiceIndex >= activeQuiz.choices().size()) {
            quizChoiceIndex = 0;
        }
        String answer = "";
        if (activeQuiz != null && quizChoiceIndex >= 0 && quizChoiceIndex < activeQuiz.choices().size()) {
            answer = activeQuiz.choices().get(quizChoiceIndex);
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("answer", answer);
        if (localPlayerId != null) {
            payload.put("playerId", localPlayerId);
        }
        var maybeAction = AvailableActionMatcher.findFirstMatching(
                availableActionsSnapshot(),
                "answer_quiz",
                payload,
                this::toPayload
        );
        if (maybeAction.isEmpty()) {
            emitter.announceError("Action quiz indisponible (pas d'action serveur correspondante).");
            return;
        }
        if (dispatchAction(maybeAction.get())) {
            activeQuiz = null;
            quizChoiceIndex = -1;
            if (quizComponent != null) {
                quizComponent.highlightChoice(-1);
            }
            infoLabel.setText("");
        }
    }

    /**
     * Si une demande de carte est en attente pour le joueur local, envoie une réponse par défaut (refus)
     * sauf si l'action sélectionnée est une acceptation explicite.
     */
    // (logique déplacée : répondre manuellement via actions/shortcuts)

    private void renderActions(GenericGameState state) {
        actionsModel.clear();
        if (state != null && state.actions() != null) {
            state.actions().forEach(actionsModel::addElement);
        }
        refreshDiscardOptions(state);
        if (!actionsModel.isEmpty()) {
            selectActionForPending(state);
            if (exchangePending) {
                refreshExchangeInfoLabel();
                announceExchangeSelectionIfNeeded(actionsList.getSelectedIndex() < 0 ? 0 : actionsList.getSelectedIndex());
            }
        }
    }

    private void renderTurn(GenericGameState state) {
        TurnState turn = null;
        Object turnNode = state.extras().get("turn");
        if (turnNode instanceof JsonNode node && node.isObject()) {
            turn = turnController.map(node).orElse(null);
        }

        if (turn == null) {
            // Pas d'info de tour -> on évite d'annoncer un faux joueur.
            tableState.updateTurn(state.round(), -1, 1);
            tableState.updateCurrentPlayerId(null);
            statusPanel.update(state.status(), state.phase(), state.round(), -1, state.lastRoll());
            lastTurnIndexSeen = null;
            if (turnAnnouncementTracker.decide(tableState.started(), null, -1, state.round(), false, true).announce()) {
                String message = turnController.formatTurn(new TurnState(state.round(), -1, 1, null, null), tableState);
                emitter.announceEvent(message);
                pregameAnnounced = true;
            }
            lastAnnouncedPlayerId = null;
            return;
        }

        statusPanel.update(state.status(), state.phase(), turn.round(), turn.index(), state.lastRoll());
        tableState.updateTurn(turn.round(), turn.index(), turn.direction());
        tableState.updateCurrentPlayerId(turn.currentPlayerId());
        // resynchronise l'ordre des participants avant d'annoncer le tour
        RoomParticipantsMapper.updateFromExtras(tableState, state.extras());
        if (!tableState.started()) {
            if (turnAnnouncementTracker.decide(false, null, -1, turn.round(), true, true).announce()) {
                String message = turnController.formatTurn(turn, tableState);
                emitter.announceEvent(message);
                pregameAnnounced = true;
            }
            lastTurnIndexSeen = null;
            lastAnnouncedPlayerId = null;
            return;
        }
        // Ne rien annoncer si l'index est inconnu et pas d'ID courant.
        if (turn.index() < 0 && turn.currentPlayerId() == null) {
            lastTurnIndexSeen = null;
            lastAnnouncedPlayerId = null;
            return;
        }
        // éviter les doublons quand le même joueur reste courant
        if (turnAnnouncementTracker.decide(true, turn.currentPlayerId(), turn.index(), turn.round(), true, true).announce()) {
            lastTurnIndexSeen = turn.index();
            lastAnnouncedPlayerId = turn.currentPlayerId();
            String message = turnController.formatTurn(turn, tableState);
            emitter.announceEvent(message);
        }
    }

    private void updateBotTurnLock(GenericGameState state) {
        boolean botFlag = state != null && state.botThinking();
        if (!botFlag) {
            botFlag = isCurrentPlayerBot();
        }
        botTurnLocked = botFlag;
        if (!botTurnLocked) {
            botLockNotified = false;
            infoLabel.setText("");
        }
        if (botTurnLocked && !botLockNotified) {
            infoLabel.setText("Tour du bot, merci de patienter...");
            botLockNotified = true;
        }
    }

    private boolean isCurrentPlayerBot() {
        Integer currentId = tableState.currentPlayerId();
        if (currentId == null) {
            return false;
        }
        return tableState.bots().stream().anyMatch(b -> currentId.equals(b.id()));
    }

    private String buildRollMessage(Integer roll) {
        String name = resolveCurrentName();
        return name + " lance le dé : \"" + roll + "\"";
    }

    private String resolveCurrentName() {
        int idx = tableState.turnIndex();
        var players = tableState.players();
        var bots = tableState.bots();
        if (idx >= 0 && idx < players.size()) {
            String username = players.get(idx).username();
            if (username != null && !username.isBlank()) {
                return username;
            }
        }
        int botIdx = idx - players.size();
        if (botIdx >= 0 && botIdx < bots.size()) {
            String name = bots.get(botIdx).name();
            if (name != null && !name.isBlank()) {
                return name;
            }
        }
        return "Le joueur";
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

    private void selectActionForPending(GenericGameState state) {
        String pendingType = extractPendingType(state);
        int selected = pendingActionSelector.selectIndex(
                availableActionsSnapshot(),
                pendingType,
                a -> a instanceof GenericGameState.GenericAction ga ? ga.type() : null
        );
        if (selected < 0) return;
        actionsList.setSelectedIndex(selected);
        actionsList.ensureIndexIsVisible(selected);
    }

    private String extractPendingType(GenericGameState state) {
        if (state == null) return null;
        Object pendingRaw = state.pending();
        if (pendingRaw instanceof JsonNode node) {
            return node.path("type").asText("");
        }
        if (pendingRaw != null) {
            JsonNode node = mapper.valueToTree(pendingRaw);
            return node.path("type").asText("");
        }
        return null;
    }

    private void renderPending(Object pending) {
        if (pending instanceof GenericGameState.PendingQuiz quiz && !isLocalQuiz(quiz)) {
            pendingLabel.setText("");
            return;
        }
        if (askDialogOpen) {
            pendingLabel.setText(infoLabelFormatter.formatAskLabel(
                    askDialogOpen,
                    askTargets.stream().map(PlayerOption::name).toList(),
                    askTargetIndex,
                    askCards.stream().map(AskCardOption::label).toList(),
                    askCardIndex,
                    giveCards.stream().map(AskCardOption::label).toList(),
                    askGiveIndex,
                    askFocusIndex
            ));
            return;
        }
        boolean wasExchangePending = exchangePending;
        JsonNode node = pending == null ? null : mapper.valueToTree(pending);
        PendingViewModel.Result r = pendingViewModel.compute(
                node,
                wasExchangePending,
                exchangePending,
                infoLabel.getText() != null && infoLabel.getText().startsWith("Quiz")
        );
        exchangePending = r.exchangePending();
        if (r.resetExchangeNavigator()) {
            exchangeNavigator.reset();
        }
        if (r.clearInfoLabelIfNotQuiz()) {
            infoLabel.setText("");
        }
        pendingLabel.setText(r.pendingLabel());
    }

    private void renderPlayerCollections(GenericGameState state) {
        if (state != null) {
            JsonNode extrasNode = mapper.valueToTree(state.extras());
            var resolved = playerCollectionsViewModel.resolve(extrasNode, localUserId, localUsername);
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
        if (state != null && state.pendingQuiz() != null && !isLocalQuiz(state.pendingQuiz())) {
            infoLabel.setText("");
        }

        // Ne pas écraser les raccourcis globaux de table (ex: b / Maj+b pour les bots) avant le démarrage.
        boolean allowDynamic = tableState != null && tableState.started();
        Object raw = allowDynamic ? state.extras().get("shortcuts") : null;
        if (raw instanceof JsonNode node && node.isArray()) {
            // Les extras arrivent souvent en JsonNode : les convertir pour que le binding fonctionne.
            raw = mapper.convertValue(node, java.util.List.class);
        }
        if (raw instanceof java.util.List<?> list) {
            java.util.List<Map<String, Object>> parsed = new java.util.ArrayList<>();
            for (Object item : list) {
                try {
                    Map<String, Object> m = mapper.convertValue(item, Map.class);
                    parsed.add(m);
                } catch (IllegalArgumentException ignored) {
                }
            }
            dynamicShortcuts = parsed;
            rebindDynamicShortcuts();
            return;
        }
        // Pas de shortcuts fournis ou partie non démarrée : nettoyer les bindings dynamiques.
        dynamicShortcuts = java.util.List.of();
        rebindDynamicShortcuts();
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
            case "shopping" -> announceCollection("shopping", shoppingView);
            case "basket" -> announceCollection("basket", basketView);
            case "inventory" -> announceCollection("inventory", inventoryView);
            case "position" -> announcePosition();
            case "hand" -> announceHand();
            case "books" -> announceBooks();
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
                    openAskDialog();
                    return;
                }
                dispatchAction(act);
                return;
            }
        }
    }

    private java.util.List<String> toStringList(Object raw) {
        if (raw == null) return java.util.List.of();
        if (raw instanceof java.util.List<?> list) {
            return list.stream()
                    .map(v -> v == null ? "" : v.toString())
                    .filter(s -> !s.isBlank())
                    .toList();
        }
        if (raw instanceof JsonNode node && node.isArray()) {
            java.util.List<String> vals = new java.util.ArrayList<>();
            node.forEach(n -> {
                if (n != null && !n.asText("").isBlank()) {
                    vals.add(n.asText(""));
                }
            });
            return vals;
        }
        String s = raw.toString();
        return s.isBlank() ? java.util.List.of() : java.util.List.of(s);
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
        emitter.announceEvent(collectionAnnouncementFormatter.formatCollectionAnnouncement(id, values));
    }

    private void announcePosition() {
        Integer currentId = tableState.currentPlayerId();
        int turn = tableState.turnRound();
        // Les positions par joueur sont dans extras.board.positions si exposé, sinon annoncer juste le tour.
        Object boardNode = currentStateExtras().get("board");
        String message = null;
        if (boardNode instanceof JsonNode board && board.has("positions") && board.get("positions").isObject() && currentId != null) {
            JsonNode pos = board.get("positions").get(String.valueOf(currentId));
            if (pos != null && pos.isInt() && board.has("tiles") && board.get("tiles").isArray()) {
                int index = pos.asInt();
                int total = board.get("tiles").size();
                message = positionAnnouncementFormatter.formatPosition(index, total, turn);
            }
        }
        if (message == null) {
            message = positionAnnouncementFormatter.formatPosition(-1, 0, turn);
        }
        emitter.announceEvent(message);
    }

    private void announceHand() {
        Object handRaw = currentStateExtras().get("hand");
        List<String> hand = toStringList(handRaw);
        emitter.announceEvent(listAnnouncementFormatter.format("Main", hand, "Main vide"));
    }

    private void announceBooks() {
        Object booksRaw = currentStateExtras().get("books");
        List<String> books = toStringList(booksRaw);
        if (books == null || books.isEmpty()) {
            emitter.announceEvent("Aucune famille complétée");
            return;
        }
        emitter.announceEvent(listAnnouncementFormatter.format("Familles complétées", books, "Aucune famille complétée"));
    }

    private Map<String, Object> currentStateExtras() {
        GenericGameState state = lastState;
        if (state == null || state.extras() == null) {
            return Map.of();
        }
        return state.extras();
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
        return botTurnGate.shouldBlock(tableState.started(), botTurnLocked, activeQuiz != null, isPendingAskForMe());
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

    private record PlayerOption(int id, String name) {}
    private record AskCardOption(String familyId, String memberId, String label) {}

    private void announceStats() {
        if (lastState == null || lastState.extras() == null) {
            emitter.announceEvent("Aucune statistique disponible.");
            return;
        }
        Object metaNode = lastState.extras().get("metadata");
        if (!(metaNode instanceof JsonNode node)) {
            emitter.announceEvent("Statistiques non disponibles.");
            return;
        }
        int pollution = node.path("pollution").asInt(0);
        int maxPollution = node.path("maxPollution").asInt(0);
        int familyGoal = node.path("familyGoal").asInt(0);
        int books = 0;
        Object playersNode = lastState.extras().get("players");
        if (playersNode instanceof JsonNode pNode && pNode.isArray()) {
            for (JsonNode p : pNode) {
                books += p.path("books").isArray() ? p.get("books").size() : 0;
            }
        }
        emitter.announceEvent(statsAnnouncementFormatter.format(pollution, maxPollution, books, familyGoal));
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
        if (submitIfQuizActive()) {
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
            openAskDialog();
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
        if (activeQuiz != null) {
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
        if (submitIfQuizActive()) {
            return;
        }
        // Si un mini-dialogue est ouvert, Entrée valide la sélection.
        if (askDialogOpen) {
            sendAskDialog();
            return;
        }
        if (discardDialogOpen) {
            sendDiscardSelection();
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
        if (handleDiscardFlow()) {
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

    private void openAskDialog() {
        GenericGameState state = lastState;
        if (state == null) return;
        refreshAskDialogData(state);
        if (askTargets.isEmpty() || askCards.isEmpty()) {
            emitter.announceError("Aucune cible ou carte disponible pour demander.");
            askDialogOpen = false;
            return;
        }
        askDialogOpen = true;
        askFocusIndex = 0;
        refreshInfoLabel();
        pendingLabel.setText(infoLabelFormatter.formatAskLabel(
                askDialogOpen,
                askTargets.stream().map(PlayerOption::name).toList(),
                askTargetIndex,
                askCards.stream().map(AskCardOption::label).toList(),
                askCardIndex,
                giveCards.stream().map(AskCardOption::label).toList(),
                askGiveIndex,
                askFocusIndex
        ));
    }

    private void refreshAskDialogData(GenericGameState state) {
        this.askTargets = extractAskTargets(state);
        this.askCards = extractAskCards(state);
        this.giveCards = extractGiveCards(state);
        if (askTargetIndex >= askTargets.size()) askTargetIndex = askTargets.isEmpty() ? 0 : askTargets.size() - 1;
        if (askCardIndex >= askCards.size()) askCardIndex = askCards.isEmpty() ? 0 : askCards.size() - 1;
        if (askFocusIndex == 2 && giveCards.isEmpty()) askFocusIndex = 0;
        if (askTargets.isEmpty() || askCards.isEmpty()) {
            askDialogOpen = false;
        }
        refreshInfoLabel();
    }

    private List<PlayerOption> extractAskTargets(GenericGameState state) {
        List<PlayerOption> res = new ArrayList<>();
        Object pvNode = state.extras().get("playerViews");
        if (pvNode instanceof JsonNode node && node.isArray()) {
            for (JsonNode v : node) {
                if (!v.path("id").isInt()) continue;
                int id = v.get("id").asInt();
                if (localPlayerId != null && id == localPlayerId) continue;
                String name = v.path("username").asText("Joueur " + id);
                res.add(new PlayerOption(id, name));
            }
        }
        return res;
    }

    private List<AskCardOption> extractAskCards(GenericGameState state) {
        List<AskCardOption> res = new ArrayList<>();
        Object handNode = state.extras().get("handCards");
        if (handNode instanceof JsonNode node && node.isArray()) {
            for (JsonNode c : node) {
                String familyId = c.path("familyId").asText("");
                String memberId = c.path("memberId").asText("");
                String label = c.path("label").asText(familyId + "-" + memberId);
                if (!familyId.isBlank() && !memberId.isBlank()) {
                    res.add(new AskCardOption(familyId, memberId, label));
                }
            }
        }
        return res;
    }

    private List<AskCardOption> extractGiveCards(GenericGameState state) {
        List<AskCardOption> res = new ArrayList<>();
        Object handNode = state.extras().get("handCards");
        if (handNode instanceof JsonNode node && node.isArray()) {
            for (JsonNode c : node) {
                String familyId = c.path("familyId").asText("");
                String memberId = c.path("memberId").asText("");
                String label = c.path("label").asText(familyId + "-" + memberId);
                if (!familyId.isBlank() && !memberId.isBlank()) {
                    res.add(new AskCardOption(familyId, memberId, label));
                }
            }
        }
        return res;
    }

    private void moveAskFocus(boolean backward) {
        if (!askDialogOpen) return;
        int step = backward ? -1 : 1;
        askFocusIndex = (askFocusIndex + step + 5) % 5;
        refreshInfoLabel();
    }

    private void moveAskSelection(int delta) {
        if (!askDialogOpen) return;
        if (askFocusIndex == 0 && !askTargets.isEmpty()) {
            askTargetIndex = (askTargetIndex + delta + askTargets.size()) % askTargets.size();
        } else if (askFocusIndex == 1 && !askCards.isEmpty()) {
            askCardIndex = (askCardIndex + delta + askCards.size()) % askCards.size();
        } else if (askFocusIndex == 2 && !giveCards.isEmpty()) {
            askGiveIndex = (askGiveIndex + delta + giveCards.size()) % giveCards.size();
        } else if (askFocusIndex == 3 && delta > 0) {
            sendAskDialog();
            return;
        } else if (askFocusIndex == 4 && delta > 0) {
            cancelAskDialog();
            return;
        }
        refreshInfoLabel();
    }

    private void sendAskDialog() {
        if (!askDialogOpen) return;
        if (askTargets.isEmpty() || askCards.isEmpty() || localPlayerId == null) {
            cancelAskDialog();
            return;
        }
        PlayerOption target = askTargets.get(Math.max(0, Math.min(askTargetIndex, askTargets.size() - 1)));
        AskCardOption card = askCards.get(Math.max(0, Math.min(askCardIndex, askCards.size() - 1)));
        AskCardOption give = giveCards.isEmpty() ? null : giveCards.get(Math.max(0, Math.min(askGiveIndex, giveCards.size() - 1)));
        Map<String, Object> payload = new HashMap<>();
        payload.put("target", target.id());
        payload.put("familyId", card.familyId());
        payload.put("memberId", card.memberId());
        payload.put("playerId", localPlayerId);
        if (give != null) {
            payload.put("offerMemberId", give.memberId());
        }
        var maybeAction = AvailableActionMatcher.findFirstMatching(
                availableActionsSnapshot(),
                "ask_card",
                payload,
                this::toPayload
        );
        if (maybeAction.isEmpty()) {
            emitter.announceError("Action demande de carte indisponible (pas d'action serveur correspondante).");
            return;
        }
        dispatchAction(maybeAction.get());
        askDialogOpen = false;
        refreshInfoLabel();
    }

    private void cancelAskDialog() {
        askDialogOpen = false;
        refreshInfoLabel();
    }

    private List<AskCardOption> extractDiscardOptions(GenericGameState state) {
        return extractGiveCards(state);
    }

    private void refreshDiscardOptions(GenericGameState state) {
        List<AskCardOption> options = state == null ? List.of() : extractDiscardOptions(state);
        discardOptions = options;
        if (discardIndex >= discardOptions.size()) {
            discardIndex = discardOptions.isEmpty() ? 0 : discardOptions.size() - 1;
        }
        if (discardOptions.isEmpty() || !hasActionMatching(GameActionUtils::isDiscardAction)) {
            discardDialogOpen = false;
        }
        if (discardDialogOpen) {
            refreshInfoLabel();
        }
    }

    private void openDiscardDialog() {
        if (discardOptions.isEmpty()) {
            // Fallback : envoyer la première action si aucune info d'option n'est disponible.
            dispatchActionMatching(GameActionUtils::isDiscardAction);
            return;
        }
        discardDialogOpen = true;
        if (discardIndex < 0 || discardIndex >= discardOptions.size()) {
            discardIndex = 0;
        }
        refreshInfoLabel();
    }

    private void moveDiscardSelection(int delta) {
        if (!discardDialogOpen || discardOptions.isEmpty()) {
            return;
        }
        int size = discardOptions.size();
        int next = discardIndex + delta;
        if (next < 0) {
            next = size - 1;
        } else if (next >= size) {
            next = 0;
        }
        discardIndex = next;
        refreshInfoLabel();
    }

    private void sendDiscardSelection() {
        if (!discardDialogOpen) return;
        discardDialogOpen = false;
        if (discardOptions.isEmpty()) {
            dispatchActionMatching(GameActionUtils::isDiscardAction);
            return;
        }
        AskCardOption opt = discardOptions.get(Math.max(0, Math.min(discardIndex, discardOptions.size() - 1)));
        for (int i = 0; i < actionsModel.size(); i++) {
            GenericGameState.GenericAction act = actionsModel.get(i);
            if (act == null || act.type() == null) continue;
            if (!"discard_card".equalsIgnoreCase(act.type())) continue;
            Map<String, Object> payload = toPayload(act.payload());
            String actMember = String.valueOf(payload.getOrDefault("memberId", ""));
            String actFamily = String.valueOf(payload.getOrDefault("familyId", ""));
            if (opt.memberId().equals(actMember) || (actMember.isBlank() && opt.familyId().equals(actFamily))) {
                dispatchAction(act);
                refreshInfoLabel();
                return;
            }
        }
        emitter.announceError("Action défausse indisponible (pas d'action serveur correspondante).");
        refreshInfoLabel();
    }

    private void cancelDiscardDialog() {
        discardDialogOpen = false;
        refreshInfoLabel();
    }

    private boolean handleDiscardFlow() {
        if (!hasActionMatching(GameActionUtils::isDiscardAction)) {
            discardDialogOpen = false;
            return false;
        }
        if (discardDialogOpen) {
            sendDiscardSelection();
            return true;
        }
        openDiscardDialog();
        return true;
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

    private String buildAskLabel() {
        if (!askDialogOpen || askTargets.isEmpty() || askCards.isEmpty()) {
            return "";
        }
        PlayerOption target = askTargets.get(Math.max(0, Math.min(askTargetIndex, askTargets.size() - 1)));
        AskCardOption card = askCards.get(Math.max(0, Math.min(askCardIndex, askCards.size() - 1)));
        AskCardOption give = giveCards.isEmpty() ? null : giveCards.get(Math.max(0, Math.min(askGiveIndex, giveCards.size() - 1)));
        String focus;
        switch (askFocusIndex) {
            case 0 -> focus = "[Cible]";
            case 1 -> focus = "[Carte demandée]";
            case 2 -> focus = "[Carte offerte]";
            case 3 -> focus = "[Demander]";
            case 4 -> focus = "[Annuler]";
            default -> focus = "";
        }
        return String.format("%s Demander : cible=%s | carte=%s | offre=%s | Tab/Shift+Tab pour naviguer, ←/→ pour changer, Entrée pour valider, Échap pour annuler.",
                focus, target.name(), card.label(), give != null ? give.label() : "(aucune)");
    }

    private String buildDiscardLabel() {
        if (discardOptions.isEmpty()) {
            return "Choisissez une carte à défausser (aucune carte disponible).";
        }
        AskCardOption opt = discardOptions.get(Math.max(0, Math.min(discardIndex, discardOptions.size() - 1)));
        return "Défausser : " + opt.label() + " (" + (discardIndex + 1) + "/" + discardOptions.size() + ") - flèches pour naviguer, Entrée pour valider.";
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
        tableState.updateStatus(state.status());
        if (state.extras().isEmpty()) {
            return;
        }
        RoomParticipantsMapper.updateFromExtras(tableState, state.extras());
    }

    private void announceQuizSelectionIfNeeded() {
        if (activeQuiz == null || activeQuiz.choices().isEmpty()) {
            lastAnnouncedQuizChoice = -1;
            return;
        }
        if (quizChoiceIndex < 0 || quizChoiceIndex >= activeQuiz.choices().size()) {
            return;
        }
        if (quizChoiceIndex == lastAnnouncedQuizChoice) {
            return;
        }
        lastAnnouncedQuizChoice = quizChoiceIndex;
        emitter.announceEvent(buildQuizSelectionAnnouncement(activeQuiz.choices(), quizChoiceIndex));
    }

    private String buildQuizSelectionAnnouncement(List<String> choices, int index) {
        return GameActionUtils.buildQuizSelectionAnnouncement(choices, index);
    }

    private void handleExchangeNavigation(int delta) {
        if (!exchangePending || actionsModel.isEmpty()) {
            return;
        }
        int size = actionsModel.size();
        int current = exchangeNavigator.nextIndex(actionsList.getSelectedIndex(), size, delta);
        if (current < 0) return;
        actionsList.setSelectedIndex(current);
        actionsList.ensureIndexIsVisible(current);
        announceExchangeSelectionIfNeeded(current);
        refreshExchangeInfoLabel();
    }

    private void refreshExchangeInfoLabel() {
        if (!exchangePending || actionsModel.isEmpty()) {
            exchangeNavigator.reset();
            return;
        }
        int idx = actionsList.getSelectedIndex();
        if (idx < 0 || idx >= actionsModel.size()) {
            idx = 0;
            actionsList.setSelectedIndex(idx);
        }
        GenericGameState.GenericAction act = actionsModel.get(idx);
        infoLabel.setText(buildExchangeLabel(act, idx, actionsModel.size()));
    }

    private void announceExchangeSelectionIfNeeded(int index) {
        if (!exchangeNavigator.shouldAnnounce(index, exchangePending, actionsModel.size())) {
            return;
        }
        GenericGameState.GenericAction act = actionsModel.get(index);
        emitter.announceEvent(buildExchangeLabel(act, index, actionsModel.size()));
    }

    private String buildExchangeLabel(GenericGameState.GenericAction action, int index, int total) {
        Map<String, Object> payload = toPayload(action.payload());
        Object target = payload.getOrDefault("targetPlayerId", "?");
        Object give = payload.getOrDefault("give", "?");
        Object take = payload.getOrDefault("take", "?");
        String targetName = resolveNameForId(target);
        return "Échanger " + give + " contre " + take + " avec " + targetName + " (" + (index + 1) + "/" + total + ")";
    }

    private String buildActionLabel(GenericGameState.GenericAction action) {
        if (action == null) return "";
        String type = action.type() == null ? "" : action.type();
        String label = action.label() == null ? "" : action.label();
        if (!label.isBlank()) return label;
        return type;
    }

    private String resolveNameForId(Object idObj) {
        if (idObj == null) return "?";
        try {
            Integer id = Integer.valueOf(idObj.toString());
            for (var p : tableState.players()) {
                if (p != null && p.id() != null && p.id().equals(id)) {
                    return p.username() == null || p.username().isBlank() ? "Joueur" : p.username();
                }
            }
            for (var b : tableState.bots()) {
                if (b != null && b.id() != null && b.id().equals(id)) {
                    return b.name() == null || b.name().isBlank() ? "Bot" : b.name();
                }
            }
            return "Joueur " + id;
        } catch (NumberFormatException e) {
            return idObj.toString();
        }
    }

    private String sanitizeLogLine(String line) {
        return announcementFormatter.sanitizeLogLine(line);
    }

    private String buildQuizAnnouncement(String question, List<String> choices) {
        return announcementFormatter.buildQuizAnnouncement(question, choices);
    }

    private String buildQuizChoicesLabel(String question, List<String> choices) {
        return infoLabelFormatter.formatQuizChoicesLabel(question, choices);
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
