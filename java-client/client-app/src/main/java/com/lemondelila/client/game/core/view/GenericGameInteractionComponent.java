package com.lemondelila.client.game.core.view;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.ui.keyboard.KeyboardBindings;
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

/**
 * Composant d'interaction gĂŠnĂŠrique pour les jeux (statut, quiz, logs, action primaire).
 */
public final class GenericGameInteractionComponent extends JPanel implements GameInteractionComponent, GenericGameInteractionController.Listener, PrimaryActionCapable {

    private final GenericGameInteractionController controller;
    private final GameActionEmitter emitter;
    private final GameHistoryController history;
    private final TableState tableState;
    private final Runnable startHandler;
    private final GameStatusPanel statusPanel;
    private final GameQuizComponent quizComponent;
    private final PrimaryActionDescriptor primaryAction;
    private final TurnController turnController;
    private final JLabel infoLabel = new JLabel();
    private final Set<String> seenLogs = new HashSet<>();
    private Integer lastRollSeen;
    private boolean gameStarted;
    private boolean startAnnounced;
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
                                           Runnable startHandler) {
        super(new BorderLayout(8, 8));
        setFocusable(true);
        this.controller = Objects.requireNonNull(controller, "controller");
        this.emitter = Objects.requireNonNull(emitter, "emitter");
        this.history = Objects.requireNonNull(history, "history");
        this.tableState = Objects.requireNonNull(tableState, "tableState");
        this.primaryAction = primaryAction;
        this.startHandler = startHandler;
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

        JPanel left = new JPanel(new BorderLayout(6, 6));
        left.add(statusPanel, BorderLayout.NORTH);
        if (quizComponent != null) {
            left.add(quizComponent.getComponent(), BorderLayout.CENTER);
        }
        left.add(infoLabel, BorderLayout.SOUTH);

        cardContainer.add(left, CARD_DEFAULT);
        add(cardContainer, BorderLayout.CENTER);

        if (primaryAction != null) {
            KeyboardBindings.bindEnter(this, this::triggerPrimaryAction, "generic.enter.primary");
            javax.swing.InputMap windowMap = getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
            javax.swing.ActionMap actions = getActionMap();
            windowMap.put(javax.swing.KeyStroke.getKeyStroke("ENTER"), "generic.enter.primary.global");
            actions.put("generic.enter.primary.global", new javax.swing.AbstractAction() {
                @Override
                public void actionPerformed(java.awt.event.ActionEvent e) {
                    triggerPrimaryAction();
                }
            });
            configureQuizNavigation(windowMap, actions);
        }
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
        seenLogs.clear();
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
        });
    }

    private void renderState(GenericGameState state) {
        statusPanel.update(state.status(), state.phase(), state.round(), state.turnIndex(), state.lastRoll());
        boolean startedFlag = "started".equalsIgnoreCase(state.status());
        gameStarted = startedFlag;
        tableState.updateStatus(state.status());
        if (startedFlag) {
            tableState.markStarted();
            if (!startAnnounced) {
                emitter.announceEvent("La partie vient de démarrer, bon jeu !");
                startAnnounced = true;
            }
        } else {
            startAnnounced = false;
        }
        renderTurn(state);
        renderLogs(state.logs());
        renderQuiz(state.pendingQuiz());
        syncTableState(state);
    }

    private void renderLogs(List<String> logs) {
        if (logs == null) return;
        for (String line : logs) {
            if (line == null || line.isBlank()) continue;
            if (seenLogs.add(line)) {
                emitter.announceEvent(line);
            }
        }
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
        controller.sendActions(List.of(ActionRequest.of("answer_quiz", Map.of("choice", quizChoiceIndex))));
        activeQuiz = null;
        quizChoiceIndex = -1;
        if (quizComponent != null) {
            quizComponent.highlightChoice(-1);
        }
        infoLabel.setText("");
    }

    private void renderTurn(GenericGameState state) {
        TurnState turn = null;
        Object turnNode = state.extras().get("turn");
        if (turnNode instanceof JsonNode node && node.isObject()) {
            turn = turnController.map(node).orElse(null);
        }
        if (turn == null) {
            turn = new TurnState(state.round(), state.turnIndex(), 1, null);
        }
        statusPanel.update(state.status(), state.phase(), turn.round(), turn.index(), state.lastRoll());
        tableState.updateTurn(turn.round(), turn.index(), turn.direction());
        tableState.updateCurrentPlayerId(turn.currentPlayerId());
        if (lastTurnIndexSeen == null || !lastTurnIndexSeen.equals(turn.index())) {
            lastTurnIndexSeen = turn.index();
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
            if (primaryAction != null) {
                controller.triggerPrimaryAction();
            }
            return;
        }
        if (primaryAction != null) {
            controller.triggerPrimaryAction();
        }
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
