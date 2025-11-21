package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.framework.ui.keyboard.KeyboardBindings;
import com.lemondelila.client.game.core.GameAnnouncer;
import com.lemondelila.client.game.core.GameInteractionComponent;
import com.lemondelila.client.game.core.GameActionEmitter;
import com.lemondelila.client.game.history.controller.GameHistoryController;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.gamelogic.panierexpress.controller.PanierExpressInteractionController;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressLogEntry;
import com.lemondelila.client.gamelogic.panierexpress.model.PanierExpressState;

import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Zone d'interaction clavier pour Panier Express (pas de boutons, tout passe par les raccourcis).
 */
public final class PanierExpressInteractionComponent extends JPanel implements GameInteractionComponent, PanierExpressInteractionController.Listener {

    private final PanierExpressInteractionController controller;
    private final GameActionEmitter emitter;
    private final GameHistoryController history;
    private final JLabel statusLabel = new JLabel();
    private final JLabel rollLabel = new JLabel();
    private final JLabel turnLabel = new JLabel();
    private final JLabel quizLabel = new JLabel();
    private final JPanel quizChoicesPanel = new JPanel(new GridLayout(0, 1, 4, 4));
    private final Set<String> seenLogs = new HashSet<>();
    private Integer lastRollSeen;
    private Integer roomId;

    public PanierExpressInteractionComponent(PanierExpressInteractionController controller,
                                             GameAnnouncer announcer,
                                             GameHistoryController history,
                                             GameHistorySidebar historySidebar,
                                             FocusHighlighter focusHighlighter) {
        super(new BorderLayout(8, 8));
        setFocusable(true);
        this.controller = Objects.requireNonNull(controller, "controller");
        this.emitter = new GameActionEmitter(
                Objects.requireNonNull(announcer, "announcer"),
                Objects.requireNonNull(historySidebar, "historySidebar")
        );
        this.history = Objects.requireNonNull(history, "history");
        buildUi(focusHighlighter);
    }

    private void buildUi(FocusHighlighter focusHighlighter) {
        quizChoicesPanel.setBorder(javax.swing.BorderFactory.createTitledBorder("Quiz"));
        AccessibleDecorator.apply(quizChoicesPanel, AccessibleSpec.builder()
                .name("Quiz en cours")
                .description("Choisissez une reponse avec Entree")
                .build());
        focusHighlighter.apply(quizChoicesPanel);

        JPanel top = new JPanel(new GridLayout(3, 1));
        top.add(statusLabel);
        top.add(turnLabel);
        top.add(rollLabel);

        JPanel left = new JPanel(new BorderLayout(6, 6));
        left.add(top, BorderLayout.NORTH);
        left.add(quizLabel, BorderLayout.CENTER);

        JPanel quizContainer = new JPanel(new BorderLayout());
        quizContainer.add(quizChoicesPanel, BorderLayout.CENTER);

        add(left, BorderLayout.NORTH);
        add(quizContainer, BorderLayout.CENTER);

        // Entrée déclenche le lancer de dé par défaut.
        KeyboardBindings.bindEnter(this, this::announceAndRoll, "panierexpress.enter.roll");
    }

    /**
     * Appelé par l'écran parent si le focus reste sur le conteneur de table.
     */
    public void triggerRoll() {
        announceAndRoll();
    }

    @Override
    public JComponent component() {
        return this;
    }

    @Override
    public void onAttach(int roomId) {
        this.roomId = roomId;
        this.seenLogs.clear();
        controller.attach(roomId, this);
        requestFocusInWindow();
    }

    @Override
    public void onDetach() {
        controller.detach();
        roomId = null;
    }

    @Override
    public void onState(PanierExpressState state) {
        SwingUtilities.invokeLater(() -> {
            renderState(state);
            requestFocusInWindow();
        });
    }

    @Override
    public void onError(String message) {
        SwingUtilities.invokeLater(() -> emitter.announceError(message));
    }

    private void renderState(PanierExpressState state) {
        statusLabel.setText("Statut : " + state.status() + " | Phase : " + state.phase());
        turnLabel.setText("Tour " + state.round() + " - Joueur actif #" + state.turnIndex());
        rollLabel.setText(state.lastRoll() == null ? "Dernier lancer : n/a" : "Dernier lancer : " + state.lastRoll());
        if (state.lastRoll() != null && !state.lastRoll().equals(lastRollSeen)) {
            lastRollSeen = state.lastRoll();
            emitter.announceEvent("Résultat du lancer : " + state.lastRoll());
        }

        renderLogs(state.logs());
        renderQuiz(state.pendingQuiz());
    }

    private void renderLogs(List<PanierExpressLogEntry> logs) {
        for (PanierExpressLogEntry log : logs) {
            String line = log.message();
            if (line == null || line.isBlank()) {
                continue;
            }
            if (seenLogs.add(line)) {
                history.addEntry(line);
                emitter.announceEvent(line);
            }
        }
    }

    private void renderQuiz(PanierExpressState.PendingQuiz quiz) {
        quizChoicesPanel.removeAll();
        if (quiz == null) {
            quizLabel.setText("Pas de quiz en cours.");
            quizChoicesPanel.setVisible(false);
            revalidate();
            repaint();
            return;
        }
        quizChoicesPanel.setVisible(true);
        quizLabel.setText("Quiz : " + quiz.question());
        List<String> choices = quiz.choices();
        for (int i = 0; i < choices.size(); i++) {
            String label = choices.get(i);
            JLabel choiceLabel = new JLabel((i + 1) + ". " + label);
            AccessibleDecorator.apply(choiceLabel, AccessibleSpec.builder()
                    .name("Reponse " + (i + 1))
                    .description(label)
                    .build());
            quizChoicesPanel.add(choiceLabel);
        }
        revalidate();
        repaint();
    }

    private void announceAndRoll() {
        emitter.announceAction("Lancer de dé en cours...");
        controller.rollDice();
    }
}
