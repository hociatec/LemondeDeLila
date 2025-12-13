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
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.service.GameActionEmitter;
import com.lemondelila.client.game.quiz.view.GameQuizComponent;
import com.lemondelila.client.game.quiz.view.GameQuizComponentFactory;
import com.lemondelila.client.game.quiz.view.GameQuizPanel;
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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.IntStream;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.text.Normalizer;

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
    private final JLabel infoLabel = new JLabel();
    private final JLabel pendingLabel = new JLabel();
    private final JLabel shoppingLabel = new JLabel();
    private final JLabel basketLabel = new JLabel();
    private final JLabel inventoryLabel = new JLabel();
    private final String localUsername;
    private java.util.List<String> lastSelfShopping = java.util.List.of();
    private java.util.List<String> lastSelfBasket = java.util.List.of();
    private java.util.List<String> lastSelfInventory = java.util.List.of();
    private java.util.List<String> shoppingView = java.util.List.of();
    private java.util.List<String> basketView = java.util.List.of();
    private java.util.List<String> inventoryView = java.util.List.of();
    private java.util.List<Map<String, Object>> dynamicShortcuts = java.util.List.of();
    private final java.util.Set<KeyStroke> registeredShortcutKeys = new java.util.HashSet<>();
    private InputMap windowMapRef;
    private ActionMap actionMapRef;
    private final DefaultListModel<GenericGameState.GenericAction> actionsModel = new DefaultListModel<>();
    private final JList<GenericGameState.GenericAction> actionsList = new JList<>(actionsModel);
    private Integer lastRollSeen;
    private int lastAnnouncedQuizChoice = -1;
    private String lastQuizAnnouncementKey;
    private boolean exchangePending;
    private int lastAnnouncedExchangeIndex = -1;
    private boolean gameStarted;
    private boolean startAnnounced;
    private boolean firstStateRendered;
    private boolean pregameAnnounced;
    private boolean autoPrimaryDispatched;
    private boolean botTurnLocked;
    private boolean botLockNotified;
    private Integer lastAnnouncedPlayerId;
    private int lastLogCount;
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
        this.turnController = new TurnController();
        this.localUsername = EncryptedSessionVault.defaultVault()
                .load()
                .map(EncryptedSessionVault.SessionRecord::username)
                .orElse(null);
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
                handleDrawShortcut();
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
        lastLogCount = 0;
        startAnnounced = false;
        firstStateRendered = false;
        pregameAnnounced = false;
        autoPrimaryDispatched = false;
        botTurnLocked = false;
        botLockNotified = false;
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
            lastLogCount = 0;
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
        renderShortcuts(state);
    }

    private void renderLogs(List<String> logs) {
        if (logs == null) return;
        if (!tableState.started()) {
            return;
        }
        if (logs.size() < lastLogCount) {
            lastLogCount = 0;
        }
        for (int i = lastLogCount; i < logs.size(); i++) {
            String line = logs.get(i);
            if (line == null || line.isBlank()) continue;
            emitter.announceEvent(sanitizeLogLine(line));
        }
        lastLogCount = logs.size();
    }

    private void renderQuiz(GenericGameState.PendingQuiz quiz) {
        if (quizComponent == null) {
            return;
        }
        if (quiz == null) {
            activeQuiz = null;
            quizChoiceIndex = -1;
            lastAnnouncedQuizChoice = -1;
            lastQuizAnnouncementKey = null;
            exchangePending = false;
            quizComponent.clearQuiz();
            updateQuizHighlight();
            return;
        }
        LOGGER.info("[quiz] render question={} choices={}", quiz.question(), quiz.choices());
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
        if (activeQuiz == null) {
            if (exchangePending) {
                refreshExchangeInfoLabel();
            } else {
                infoLabel.setText("");
            }
            return;
        }
        List<String> choices = activeQuiz.choices();
        if (choices.isEmpty()) {
            infoLabel.setText("Quiz : aucune reponse disponible.");
            return;
        }
        if (quizChoiceIndex < 0 || quizChoiceIndex >= choices.size()) {
            infoLabel.setText(buildQuizChoicesLabel(activeQuiz.question(), choices));
            return;
        }
        infoLabel.setText("Quiz : reponse " + (quizChoiceIndex + 1) + "/" + choices.size() + " -> " + choices.get(quizChoiceIndex));
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
        controller.sendActions(List.of(ActionRequest.of("answer_quiz", Map.of("answer", answer))));
        activeQuiz = null;
        quizChoiceIndex = -1;
        if (quizComponent != null) {
            quizComponent.highlightChoice(-1);
        }
        infoLabel.setText("");
    }

    private void renderActions(GenericGameState state) {
        actionsModel.clear();
        if (state != null && state.actions() != null) {
            state.actions().forEach(actionsModel::addElement);
        }
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
            if (!tableState.started() && !pregameAnnounced) {
                String message = turnController.formatTurn(new TurnState(state.round(), -1, 1, null), tableState);
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
            if (!pregameAnnounced) {
                String message = turnController.formatTurn(new TurnState(turn.round(), -1, turn.direction(), null), tableState);
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
        Integer announceId = turn.currentPlayerId();
        boolean alreadyAnnounced = false;
        if (announceId != null) {
            alreadyAnnounced = announceId.equals(lastAnnouncedPlayerId);
        } else if (lastTurnIndexSeen != null) {
            alreadyAnnounced = lastTurnIndexSeen.equals(turn.index());
        }
        if (!alreadyAnnounced || turn.index() != lastTurnIndexSeen) {
            lastTurnIndexSeen = turn.index();
            lastAnnouncedPlayerId = announceId;
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
        Map<String, Object> payload = toPayload(selected.payload());
        controller.sendActions(List.of(ActionRequest.of(selected.type(), payload)));
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
        String pendingType = null;
        Object pendingRaw = state.pending();
        if (pendingRaw instanceof JsonNode node) {
            pendingType = node.path("type").asText("");
        } else if (pendingRaw != null) {
            JsonNode node = mapper.valueToTree(pendingRaw);
            pendingType = node.path("type").asText("");
        }
        if (pendingType == null || pendingType.isBlank()) {
            actionsList.setSelectedIndex(0);
            return;
        }
        for (int i = 0; i < actionsModel.size(); i++) {
            GenericGameState.GenericAction act = actionsModel.get(i);
            if (act == null || act.type() == null) continue;
            if (pendingType.equalsIgnoreCase(act.type())) {
                actionsList.setSelectedIndex(i);
                actionsList.ensureIndexIsVisible(i);
                return;
            }
            if ("vote".equalsIgnoreCase(pendingType) && "day_vote".equalsIgnoreCase(act.type())) {
                actionsList.setSelectedIndex(i);
                actionsList.ensureIndexIsVisible(i);
                return;
            }
            if ("exchange".equalsIgnoreCase(pendingType) && act.type().toLowerCase().contains("exchange")) {
                actionsList.setSelectedIndex(i);
                actionsList.ensureIndexIsVisible(i);
                return;
            }
        }
        actionsList.setSelectedIndex(0);
    }

    private void renderPending(Object pending) {
        boolean wasExchangePending = exchangePending;
        if (pending == null) {
            exchangePending = false;
            lastAnnouncedExchangeIndex = -1;
            pendingLabel.setText("");
            if (infoLabel.getText() != null && !infoLabel.getText().startsWith("Quiz")) {
                infoLabel.setText("");
            }
            return;
        }
        exchangePending = false;
        if (pending instanceof GenericGameState.PendingGeneric gen && gen.type() != null && gen.type().equalsIgnoreCase("exchange")) {
            exchangePending = true;
        } else if (pending instanceof JsonNode node && "exchange".equalsIgnoreCase(node.path("type").asText())) {
            exchangePending = true;
        }
        if (!wasExchangePending && exchangePending) {
            lastAnnouncedExchangeIndex = -1;
        }
        String text = describePending(pending);
        if (text != null && !text.isBlank()) {
            pendingLabel.setText(text);
        }
    }

    private void renderPlayerCollections(GenericGameState state) {
        boolean updated = false;
        if (localUsername != null) {
            Object playersNode = state.extras().get("players");
            if (playersNode instanceof JsonNode node && node.isArray()) {
                for (JsonNode p : node) {
                    String name = p.path("username").asText("");
                    if (name != null && name.equalsIgnoreCase(localUsername)) {
                        updateCollectionsFromLists(
                                toStringList(p.get("shoppingList")),
                                toStringList(p.get("basket")),
                                toStringList(p.get("inventory"))
                        );
                        updated = true;
                        break;
                    }
                }
            }
        }
        Object view = state.extras().get("currentPlayerView");
        if (view == null && state != null) {
            // Fallback si le serveur ne met pas la vue dans extras.
            view = state.extras().get("playerView");
        }
        if (view == null) {
            // Conserver la dernière vue connue si disponible.
            shoppingLabel.setText("S : " + formatList(shoppingView));
            basketLabel.setText("B : " + formatList(basketView));
            inventoryLabel.setText("I : " + formatList(inventoryView));
            return;
        }
        java.util.Map<String, Object> asMap = mapper.convertValue(view, java.util.Map.class);
        shoppingView = toStringList(asMap.get("shoppingList"));
        basketView = toStringList(asMap.get("basket"));
        inventoryView = toStringList(asMap.get("inventory"));
        // Si la vue courante correspond à l'utilisateur local, la prendre comme source fiable.
        String viewUser = asMap.get("username") == null ? "" : asMap.get("username").toString();
        if (!updated && localUsername != null && viewUser.equalsIgnoreCase(localUsername)) {
            updateCollectionsFromLists(shoppingView, basketView, inventoryView);
            updated = true;
        }
        if (!updated) {
            // Sinon, ne pas écraser la vue locale si nous l'avons déjà ; utiliser celle du tour uniquement si rien n'était connu.
            shoppingLabel.setText("S : " + formatList(shoppingView));
            basketLabel.setText("B : " + formatList(basketView));
            inventoryLabel.setText("I : " + formatList(inventoryView));
        }
    }

    private void renderShortcuts(GenericGameState state) {
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
        // retirer anciens
        for (KeyStroke ks : registeredShortcutKeys) {
            windowMapRef.remove(ks);
            actionMapRef.remove("dyn." + ks.toString());
        }
        registeredShortcutKeys.clear();
        for (Map<String, Object> sc : dynamicShortcuts) {
            String key = sc.getOrDefault("key", "").toString();
            if (key.isBlank()) continue;
            String type = sc.getOrDefault("type", "").toString().toLowerCase();
            KeyStroke ks = KeyStroke.getKeyStroke(key);
            if (ks == null) continue;
            String actionName = "dyn." + ks.toString();
            registeredShortcutKeys.add(ks);
            windowMapRef.put(ks, actionName);
            if ("interface".equals(type)) {
                String id = sc.getOrDefault("id", "").toString().toLowerCase();
                actionMapRef.put(actionName, new AbstractAction() {
                    @Override
                    public void actionPerformed(ActionEvent e) {
                        switch (id) {
                            case "shopping" -> announceCollection("shopping", shoppingView);
                            case "basket" -> announceCollection("basket", basketView);
                            case "inventory" -> announceCollection("inventory", inventoryView);
                            default -> {
                                // noop
                            }
                        }
                    }
                });
            } else if ("action".equals(type)) {
                String targetType = sc.getOrDefault("actionType", "").toString().toLowerCase();
                actionMapRef.put(actionName, new AbstractAction() {
                    @Override
                    public void actionPerformed(ActionEvent e) {
                        if (targetType.isBlank()) return;
                        // déclencher seulement si l'action est disponible
                        for (int i = 0; i < actionsModel.size(); i++) {
                            GenericGameState.GenericAction act = actionsModel.get(i);
                            if (act != null && targetType.equalsIgnoreCase(act.type())) {
                                actionsList.setSelectedIndex(i);
                                dispatchAction(act);
                                break;
                            }
                        }
                    }
                });
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
        String label = switch (id == null ? "" : id.toLowerCase()) {
            case "shopping", "s" -> "Liste de courses";
            case "basket", "b" -> "Panier";
            case "inventory", "i" -> "Inventaire";
            default -> "Collection";
        };
        if (values == null || values.isEmpty()) {
            emitter.announceEvent(label + " vide");
            return;
        }
        emitter.announceEvent(label + " : " + String.join(", ", values));
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

    private boolean blockIfBotTurn() {
        // Ne pas bloquer si un quiz est actif : le joueur doit pouvoir répondre.
        if (activeQuiz != null) {
            return false;
        }
        if (!botTurnLocked) {
            return false;
        }
        return true;
    }

    private String describePending(Object pending) {
        if (pending instanceof GenericGameState.PendingQuiz) {
            return null; // déjà géré ailleurs
        }
        JsonNode node = mapper.valueToTree(pending);
        if (!node.isObject()) return "";
        String type = node.path("type").asText("");
        if ("exchange".equalsIgnoreCase(type)) {
            String target = node.path("targetPlayerId").isInt() ? " avec le joueur " + node.get("targetPlayerId").asInt() : "";
            return "Échange en attente" + target;
        }
        if ("vote".equalsIgnoreCase(type) || "day_vote".equalsIgnoreCase(type)) {
            return "Vote en cours : choisissez une cible.";
        }
        if ("phase".equalsIgnoreCase(type)) {
            return "Phase en cours : " + node.path("name").asText("");
        }
        if ("quiz".equalsIgnoreCase(type)) {
            return null;
        }
        if (node.has("message")) {
            return node.get("message").asText("");
        }
        return "Action en attente...";
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
            if (!controller.hasEnoughParticipants()) {
                emitter.announceError(controller.participantRequirementMessage());
                return;
            }
            if (startHandler != null) {
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
        if (blockIfBotTurn()) {
            return false;
        }
        Map<String, Object> payload = toPayload(action.payload());
        controller.sendActions(List.of(ActionRequest.of(action.type(), payload)));
        LOGGER.info("[shortcut] action envoyee type={} payloadKeys={}", action.type(), payload.keySet());
        return true;
    }

    private void handleDrawShortcut() {
        LOGGER.info("[shortcut] espace pressed actions={}", describeActions());
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
        if (hasActionMatching(this::isDrawAction)) {
            dispatchActionMatching(this::isDrawAction);
        }
    }

    private void handleRollShortcut() {
        LOGGER.info("[shortcut] entree pressed actions={}", describeActions());
        if (submitIfQuizActive()) {
            return;
        }
        if (blockIfBotTurn()) {
            return;
        }
        if (exchangePending && hasActionMatching(this::isExchangeAction)) {
            dispatchActionMatching(this::isExchangeAction);
            return;
        }
        // Si la partie n'est pas lancee, utiliser le comportement de demarrage (equivalent bouton Start).
        if (!tableState.started()) {
            triggerPrimaryAction();
            return;
        }
        if (hasActionMatching(this::isDiceAction)) {
            dispatchActionMatching(this::isDiceAction);
            return;
        }
        // Fallback : si aucune action n'est fournie mais que la partie est en cours, tenter un "roll" explicite.
        if (actionsModel.isEmpty()) {
            controller.sendActions(List.of(ActionRequest.of("roll", java.util.Map.of())));
        }
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

    private boolean isDrawAction(GenericGameState.GenericAction action) {
        String text = normalize(action);
        return containsAny(text, "pioch", "draw", "pick", "take_card", "takecard", "take card");
    }

    private boolean isDiceAction(GenericGameState.GenericAction action) {
        String text = normalize(action);
        return containsAny(text, "roll", "dice", "lancer", "lance", "throw");
    }

    private boolean isExchangeAction(GenericGameState.GenericAction action) {
        String text = normalize(action);
        return containsAny(text, "exchange_with", "exchange", "echange");
    }

    private String normalize(GenericGameState.GenericAction action) {
        String raw = ((action.label() == null ? "" : action.label()) + " " + (action.type() == null ? "" : action.type()))
                .trim();
        String nfd = Normalizer.normalize(raw, Normalizer.Form.NFD);
        return nfd.replaceAll("\\p{M}", "").toLowerCase();
    }

    private boolean containsAny(String text, String... tokens) {
        if (text == null || text.isBlank()) return false;
        for (String token : tokens) {
            if (token != null && !token.isBlank() && text.contains(token.toLowerCase())) {
                return true;
            }
        }
        return false;
    }

    private String describeActions() {
        if (actionsModel.isEmpty()) return "[]";
        java.util.List<String> list = new java.util.ArrayList<>();
        for (int i = 0; i < actionsModel.size(); i++) {
            GenericGameState.GenericAction a = actionsModel.get(i);
            if (a == null) continue;
            list.add((a.type() == null ? "" : a.type()) + ":" + (a.label() == null ? "" : a.label()));
        }
        return list.toString();
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
        int total = choices.size();
        String choice = choices.get(index);
        return "Quiz, reponse " + (index + 1) + " sur " + total + " : " + choice;
    }

    private void handleExchangeNavigation(int delta) {
        if (!exchangePending || actionsModel.isEmpty()) {
            return;
        }
        int size = actionsModel.size();
        int current = actionsList.getSelectedIndex();
        if (current < 0 || current >= size) {
            current = 0;
        } else {
            current = (current + delta) % size;
            if (current < 0) {
                current += size;
            }
        }
        actionsList.setSelectedIndex(current);
        actionsList.ensureIndexIsVisible(current);
        announceExchangeSelectionIfNeeded(current);
        refreshExchangeInfoLabel();
    }

    private void refreshExchangeInfoLabel() {
        if (!exchangePending || actionsModel.isEmpty()) {
            lastAnnouncedExchangeIndex = -1;
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
        if (!exchangePending || actionsModel.isEmpty()) {
            lastAnnouncedExchangeIndex = -1;
            return;
        }
        if (index == lastAnnouncedExchangeIndex) {
            return;
        }
        lastAnnouncedExchangeIndex = index;
        GenericGameState.GenericAction act = actionsModel.get(index);
        emitter.announceEvent(buildExchangeLabel(act, index, actionsModel.size()));
    }

    private String buildExchangeLabel(GenericGameState.GenericAction action, int index, int total) {
        Map<String, Object> payload = toPayload(action.payload());
        Object target = payload.getOrDefault("targetPlayerId", "?");
        Object give = payload.getOrDefault("give", "?");
        Object take = payload.getOrDefault("take", "?");
        return "Echange " + (index + 1) + "/" + total + " : cible " + target + ", donner " + give + ", recevoir " + take;
    }

    private String sanitizeLogLine(String line) {
        if (line == null) {
            return "";
        }
        return line.replaceFirst("^\\[Panier Express\\]\\s*", "");
    }

    private String buildQuizAnnouncement(String question, List<String> choices) {
        StringBuilder sb = new StringBuilder();
        if (question != null && !question.isBlank()) {
            sb.append("Quiz : ").append(question.trim());
        } else {
            sb.append("Quiz en cours.");
        }
        if (choices != null && !choices.isEmpty()) {
            sb.append(" Choix : ");
            for (int i = 0; i < choices.size(); i++) {
                sb.append(i + 1).append(") ").append(choices.get(i));
                if (i < choices.size() - 1) {
                    sb.append(", ");
                }
            }
        } else {
            sb.append(" Aucun choix fourni.");
        }
        return sb.toString();
    }

    private String buildQuizChoicesLabel(String question, List<String> choices) {
        StringBuilder sb = new StringBuilder();
        sb.append("Quiz");
        if (question != null && !question.isBlank()) {
            sb.append(" : ").append(question.trim());
        }
        if (choices != null && !choices.isEmpty()) {
            sb.append(" - utilisez les fleches haut et bas puis Entree. Options : ");
            for (int i = 0; i < choices.size(); i++) {
                if (i > 0) {
                    sb.append(" / ");
                }
                sb.append(i + 1).append(") ").append(choices.get(i));
            }
        } else {
            sb.append(" - aucune option disponible.");
        }
        return sb.toString();
    }
}
