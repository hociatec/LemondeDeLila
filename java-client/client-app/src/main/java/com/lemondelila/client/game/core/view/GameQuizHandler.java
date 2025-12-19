package com.lemondelila.client.game.core.view;

import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.viewmodel.GameActionUtils;
import com.lemondelila.client.game.core.viewmodel.GameAnnouncementFormatter;
import com.lemondelila.client.game.core.viewmodel.GameInfoLabelFormatter;
import com.lemondelila.client.game.quiz.view.GameQuizComponent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.swing.*;
import java.awt.event.ActionEvent;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

/**
 * Gère l'affichage et l'interaction avec les quiz dans le jeu.
 * Extrait de GenericGameInteractionComponent pour simplifier la maintenance.
 */
public final class GameQuizHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(GameQuizHandler.class);

    private final GameQuizComponent quizComponent;
    private final Integer localPlayerId;
    private final GameAnnouncementFormatter announcementFormatter;
    private final GameInfoLabelFormatter infoLabelFormatter;

    // Callbacks vers le composant parent
    private final Consumer<String> announceEvent;
    private final Consumer<String> updateInfoLabel;
    private final BiConsumer<String, String> submitAnswer;

    // État du quiz
    private GenericGameState.PendingQuiz activeQuiz;
    private int quizChoiceIndex = -1;
    private int lastAnnouncedQuizChoice = -1;
    private String lastQuizAnnouncementKey;

    public GameQuizHandler(GameQuizComponent quizComponent,
                          Integer localPlayerId,
                          GameAnnouncementFormatter announcementFormatter,
                          GameInfoLabelFormatter infoLabelFormatter,
                          Consumer<String> announceEvent,
                          Consumer<String> updateInfoLabel,
                          BiConsumer<String, String> submitAnswer) {
        this.quizComponent = quizComponent;
        this.localPlayerId = localPlayerId;
        this.announcementFormatter = announcementFormatter;
        this.infoLabelFormatter = infoLabelFormatter;
        this.announceEvent = announceEvent;
        this.updateInfoLabel = updateInfoLabel;
        this.submitAnswer = submitAnswer;
    }

    /**
     * Configure les raccourcis clavier pour la navigation dans le quiz.
     */
    public void configureKeyboardShortcuts(InputMap inputMap, ActionMap actions) {
        if (quizComponent == null) {
            return;
        }

        actions.put("quiz.navigate.up", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                handleNavigation(-1);
            }
        });

        actions.put("quiz.navigate.down", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                handleNavigation(1);
            }
        });

        inputMap.put(KeyStroke.getKeyStroke("UP"), "quiz.navigate.up");
        inputMap.put(KeyStroke.getKeyStroke("DOWN"), "quiz.navigate.down");

        bindNumberShortcuts(inputMap, actions);
    }

    private void bindNumberShortcuts(InputMap inputMap, ActionMap actions) {
        if (quizComponent == null) {
            return;
        }

        for (int i = 0; i < 10; i++) {
            final int index = i;
            String key = "quiz.answer." + i;
            actions.put(key, new AbstractAction() {
                @Override
                public void actionPerformed(ActionEvent e) {
                    handleAnswerShortcut(index);
                }
            });
            inputMap.put(KeyStroke.getKeyStroke(String.valueOf(i)), key);
        }
    }

    /**
     * Gère la navigation dans les choix du quiz (haut/bas).
     */
    public void handleNavigation(int delta) {
        if (activeQuiz == null || activeQuiz.choices().isEmpty() || quizComponent == null) {
            return;
        }

        int size = activeQuiz.choices().size();
        int next = quizChoiceIndex;

        if (quizChoiceIndex < 0) {
            next = delta > 0 ? 0 : size - 1;
        } else {
            next = quizChoiceIndex + delta;
            if (next < 0) next = size - 1;
            if (next >= size) next = 0;
        }

        quizChoiceIndex = next;
        updateHighlight();
    }

    /**
     * Gère le raccourci clavier numérique pour sélectionner directement un choix.
     */
    public void handleAnswerShortcut(int index) {
        if (activeQuiz == null || activeQuiz.choices().isEmpty()) {
            return;
        }
        if (index < 0 || index >= activeQuiz.choices().size()) {
            return;
        }
        quizChoiceIndex = index;
        updateHighlight();
    }

    /**
     * Affiche ou masque le quiz.
     */
    public void renderQuiz(GenericGameState.PendingQuiz quiz) {
        if (quiz == null) {
            clearQuiz();
            return;
        }

        if (!isLocalQuiz(quiz)) {
            // Quiz pour un autre joueur ou un bot
            clearQuiz();
            return;
        }

        if (quizComponent == null) {
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

        quizComponent.showQuiz(quiz.question(), quiz.choices());

        if (!sameQuiz) {
            // Annonce vocale complète pour les lecteurs d'écran
            String announcement = buildQuizAnnouncement(quiz.question(), quiz.choices());
            announceEvent.accept(announcement);
            updateInfoLabel.accept(buildQuizChoicesLabel(quiz.question(), quiz.choices()));
        }

        // Forcer le rafraîchissement visuel
        JComponent quizUi = quizComponent.getComponent();
        quizUi.setVisible(true);
        quizUi.revalidate();
        quizUi.repaint();

        updateHighlight();
    }

    /**
     * Efface le quiz actif.
     */
    public void clearQuiz() {
        activeQuiz = null;
        quizChoiceIndex = -1;
        lastAnnouncedQuizChoice = -1;
        lastQuizAnnouncementKey = null;

        if (quizComponent != null) {
            quizComponent.clearQuiz();
        }
    }

    /**
     * Soumet la réponse au quiz si un est actif.
     * @return true si un quiz était actif et la réponse a été soumise
     */
    public boolean submitIfActive() {
        if (activeQuiz == null) {
            return false;
        }
        submitQuizAnswer();
        return true;
    }

    /**
     * Retourne true si un quiz est actuellement actif.
     */
    public boolean isActive() {
        return activeQuiz != null;
    }

    /**
     * Met à jour l'info label avec l'état actuel du quiz.
     */
    public void refreshInfoLabel() {
        if (activeQuiz == null) {
            updateInfoLabel.accept("");
            return;
        }

        String label = infoLabelFormatter.formatQuizInfoLabel(
            activeQuiz.question(),
            activeQuiz.choices(),
            quizChoiceIndex
        );
        updateInfoLabel.accept(label);
    }

    private void submitQuizAnswer() {
        if (activeQuiz == null || activeQuiz.choices().isEmpty()) {
            return;
        }

        if (quizChoiceIndex < 0 || quizChoiceIndex >= activeQuiz.choices().size()) {
            quizChoiceIndex = 0;
        }

        String answer = activeQuiz.choices().get(quizChoiceIndex);

        // Déléguer au parent pour soumettre l'action
        submitAnswer.accept("answer_quiz", answer);

        // Nettoyer l'état du quiz
        activeQuiz = null;
        quizChoiceIndex = -1;
        if (quizComponent != null) {
            quizComponent.highlightChoice(-1);
        }
        updateInfoLabel.accept("");
    }

    private void updateHighlight() {
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
        announceSelectionIfNeeded();
        refreshInfoLabel();
    }

    private void announceSelectionIfNeeded() {
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
        String announcement = GameActionUtils.buildQuizSelectionAnnouncement(
            activeQuiz.choices(),
            quizChoiceIndex
        );
        announceEvent.accept(announcement);
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
            return true;
        }
        return localPlayerId != null && localPlayerId.equals(quizPlayerId);
    }
}
