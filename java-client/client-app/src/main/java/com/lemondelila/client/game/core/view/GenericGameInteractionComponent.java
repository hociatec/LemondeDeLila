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
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.room.service.RoomParticipantsMapper;
import com.lemondelila.client.game.turn.controller.TurnController;
import com.lemondelila.client.game.turn.model.TurnState;
import com.lemondelila.client.game.turn.view.GameStatusPanel;
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
    private final DefaultListModel<GenericGameState.GenericAction> actionsModel = new DefaultListModel<>();
    private final JList<GenericGameState.GenericAction> actionsList = new JList<>(actionsModel);
    private Integer lastRollSeen;
    private boolean gameStarted;
    private boolean startAnnounced;
    private boolean firstStateRendered;
    private boolean pregameAnnounced;
    private boolean autoPrimaryDispatched;
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
        this.statusPanel = new GameStatusPanel(focusHighlighter);
        this.quizComponent = quizFactory == null
                ? null
                : quizFactory.map(factory -> factory.create(focusHighlighter)).orElse(null);
        buildUi(focusHighlighter);
        this.statusPanel.clear();
    }

    private void buildUi(FocusHighlighter focusHighlighter) {
        AccessibleDecorator.apply(infoLabel, AccessibleSpec.builder()
                .name("Information")
                .description("Informations sur la partie")
                .build());
        focusHighlighter.apply(infoLabel);
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
        infoPanel.add(pendingLabel, BorderLayout.NORTH);
        javax.swing.JLabel shortcutsLabel = new javax.swing.JLabel("Raccourcis : [Espace] piocher, [Entrée] lancer le dé");
        AccessibleDecorator.apply(shortcutsLabel, AccessibleSpec.builder()
                .name("Raccourcis clavier")
                .description("Espace pour piocher, Entrée pour lancer le dé quand disponible")
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
                dispatchSelectedAction();
            }
        });

        javax.swing.InputMap windowMap = getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
        javax.swing.ActionMap actions = getActionMap();
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
        for (int i = 1; i <= 9; i++) {
            final int index = i - 1;
            String actionName = "quiz.answer." + i;
            actions.put(actionName, new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    handleQuizAnswerShortcut(index);
                }
            });
            inputMap.put(KeyStroke.getKeyStroke(Integer.toString(i)), actionName);
        }
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
        if (activeQuiz == null || activeQuiz.choices().isEmpty() || quizComponent == null) {
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
        submitQuizAnswer();
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
        renderQuiz(state.pendingQuiz());
        renderPending(state.pending());
        renderActions(state);
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
            emitter.announceEvent(line);
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
            quizComponent.clearQuiz();
            updateQuizHighlight();
            return;
        }
        activeQuiz = quiz;
        quizChoiceIndex = -1;
        quizComponent.showQuiz(quiz.question(), quiz.choices());
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
        refreshInfoLabel();
    }

    private void refreshInfoLabel() {
        if (activeQuiz == null) {
            infoLabel.setText("");
            return;
        }
        List<String> choices = activeQuiz.choices();
        if (choices.isEmpty()) {
            infoLabel.setText("Quiz : aucune réponse disponible.");
            return;
        }
        if (quizChoiceIndex < 0 || quizChoiceIndex >= choices.size()) {
            infoLabel.setText("Quiz : utilisez les flèches ↑/↓ puis Entrée.");
            return;
        }
        infoLabel.setText("Quiz : réponse " + (quizChoiceIndex + 1) + "/" + choices.size() + " → " + choices.get(quizChoiceIndex));
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
        if (!alreadyAnnounced) {
            lastTurnIndexSeen = turn.index();
            lastAnnouncedPlayerId = announceId;
            String message = turnController.formatTurn(turn, tableState);
            emitter.announceEvent(message);
        }
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
        if (pending == null) {
            pendingLabel.setText("");
            if (infoLabel.getText() != null && !infoLabel.getText().startsWith("Quiz")) {
                infoLabel.setText("");
            }
            return;
        }
        String text = describePending(pending);
        if (text != null && !text.isBlank()) {
            pendingLabel.setText(text);
        }
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
        // Si la partie n'est pas lancee, utiliser le comportement de demarrage (equivalent bouton Start).
        if (!tableState.started()) {
            triggerPrimaryAction();
            return;
        }
        if (hasActionMatching(this::isDiceAction)) {
            dispatchActionMatching(this::isDiceAction);
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
}
