package com.lemondelila.client.game.core.view;

import com.fasterxml.jackson.databind.JsonNode;
import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.ui.keyboard.KeyboardBindings;
import com.lemondelila.client.game.core.GameActionEmitter;
import com.lemondelila.client.game.core.GameInteractionComponent;
import com.lemondelila.client.game.core.controller.GenericGameInteractionController;
import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.model.PrimaryActionDescriptor;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.room.model.BotState;
import com.lemondelila.client.game.room.model.PlayerState;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.turn.controller.TurnController;
import com.lemondelila.client.game.turn.model.TurnState;
import com.lemondelila.client.game.core.PrimaryActionCapable;

import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Interaction générique : affiche statut, quiz, logs, et supporte une action primaire (ENTER).
 */
public final class GenericGameInteractionComponent extends JPanel implements GameInteractionComponent, GenericGameInteractionController.Listener, PrimaryActionCapable {

    private final GenericGameInteractionController controller;
    private final GameActionEmitter emitter;
    private final GameHistoryController history;
    private final TableState tableState;
    private final GameStatusPanel statusPanel;
    private final GameQuizPanel quizPanel;
    private final PrimaryActionDescriptor primaryAction;
    private final TurnController turnController;
    private final JLabel infoLabel = new JLabel();
    private final Set<String> seenLogs = new HashSet<>();
    private Integer lastRollSeen;
    private boolean gameStarted;
    private boolean firstActionDone;
    private Integer lastTurnIndexSeen;

    public GenericGameInteractionComponent(GenericGameInteractionController controller,
                                           GameActionEmitter emitter,
                                           GameHistoryController history,
                                           TableState tableState,
                                           FocusHighlighter focusHighlighter,
                                           PrimaryActionDescriptor primaryAction) {
        super(new BorderLayout(8, 8));
        setFocusable(true);
        this.controller = Objects.requireNonNull(controller, "controller");
        this.emitter = Objects.requireNonNull(emitter, "emitter");
        this.history = Objects.requireNonNull(history, "history");
        this.tableState = Objects.requireNonNull(tableState, "tableState");
        this.primaryAction = primaryAction;
        this.turnController = new TurnController();
        this.statusPanel = new GameStatusPanel(focusHighlighter);
        this.quizPanel = new GameQuizPanel(focusHighlighter);
        buildUi(focusHighlighter);
    }

    private void buildUi(FocusHighlighter focusHighlighter) {
        AccessibleDecorator.apply(infoLabel, AccessibleSpec.builder()
                .name("Information")
                .description("Informations sur la partie")
                .build());
        focusHighlighter.apply(infoLabel);

        JPanel left = new JPanel(new BorderLayout(6, 6));
        left.add(statusPanel, BorderLayout.NORTH);
        left.add(quizPanel, BorderLayout.CENTER);
        left.add(infoLabel, BorderLayout.SOUTH);

        add(left, BorderLayout.CENTER);

        // Entrée déclenche l'action primaire si définie.
        if (primaryAction != null) {
            KeyboardBindings.bindEnter(this, this::triggerPrimaryAction, "generic.enter.primary");
            // Bind global (fenêtré) pour capter Entrée même si le focus est ailleurs dans la table.
            javax.swing.InputMap windowMap = getInputMap(JComponent.WHEN_IN_FOCUSED_WINDOW);
            javax.swing.ActionMap actions = getActionMap();
            windowMap.put(javax.swing.KeyStroke.getKeyStroke("ENTER"), "generic.enter.primary.global");
            actions.put("generic.enter.primary.global", new javax.swing.AbstractAction() {
                @Override
                public void actionPerformed(java.awt.event.ActionEvent e) {
                    triggerPrimaryAction();
                }
            });
        }
    }

    @Override
    public JComponent component() {
        return this;
    }

    @Override
    public void onAttach(int roomId) {
        seenLogs.clear();
        requestFocusInWindow();
        controller.attach(roomId, this);
    }

    @Override
    public void onDetach() {
        controller.detach();
    }

    /**
     * Rafraichit explicitement l'‚tat (utile aprŠs ajout de bot avant le premier tour).
     */
    public void refreshState() {
        controller.refresh();
    }

    @Override
    public void onState(GenericGameState state) {
        SwingUtilities.invokeLater(() -> {
            renderState(state);
            requestFocusInWindow();
        });
    }

    @Override
    public void onError(String message) {
        SwingUtilities.invokeLater(() -> {
            emitter.announceError(message);
            // Sur erreur (ex: pas assez de participants), on autorise encore les bots/participants.
            gameStarted = false;
            tableState.updateStatus("open");
        });
    }

    private void renderState(GenericGameState state) {
        statusPanel.update(state.status(), state.phase(), state.round(), state.turnIndex(), state.lastRoll());
        gameStarted = state.status() != null && !"open".equalsIgnoreCase(state.status());
        if (gameStarted) {
            tableState.markStarted();
            tableState.updateStatus(state.status());
        }
        renderTurn(state);
        if (state.lastRoll() != null && !state.lastRoll().equals(lastRollSeen)) {
            lastRollSeen = state.lastRoll();
            emitter.announceEvent("Résultat du lancer : " + state.lastRoll());
        }
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
        if (quiz == null) {
            quizPanel.clearQuiz();
            return;
        }
        quizPanel.showQuiz(quiz.question(), quiz.choices());
    }

    private void renderTurn(GenericGameState state) {
        Object turnNode = state.extras().get("turn");
        if (!(turnNode instanceof JsonNode node) || !node.isObject()) {
            return;
        }
        turnController.map(node).ifPresent(turn -> {
            statusPanel.update(state.status(), state.phase(), turn.round(), turn.index(), state.lastRoll());
            tableState.updateTurn(turn.round(), turn.index(), turn.direction());
            if (lastTurnIndexSeen == null || !lastTurnIndexSeen.equals(turn.index())) {
                lastTurnIndexSeen = turn.index();
                String message = turnController.formatTurn(turn, tableState);
                emitter.announceEvent(message);
            }
        });
    }

    @Override
    public void triggerPrimaryAction() {
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
        Object playersNode = state.extras().get("players");
        if (playersNode instanceof JsonNode node && node.isArray() && node.size() > 0) {
            var players = new java.util.ArrayList<PlayerState>();
            node.forEach(p -> players.add(new PlayerState(
                    p.path("id").isInt() ? p.get("id").asInt() : null,
                    p.path("username").asText("Joueur")
            )));
            tableState.updatePlayers(players);
        }
        Object botsNode = state.extras().get("bots");
        if (botsNode instanceof JsonNode node2 && node2.isArray() && node2.size() > 0) {
            var bots = new java.util.ArrayList<BotState>();
            node2.forEach(b -> bots.add(new BotState(
                    b.path("id").isInt() ? b.get("id").asInt() : null,
                    b.path("name").asText("Bot")
            )));
            tableState.updateBots(bots);
        }
    }
}
