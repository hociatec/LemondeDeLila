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
import java.util.Objects;
import java.util.function.BiConsumer;
import java.util.function.Consumer;

/**
 * Gère l'affichage et l'interaction avec les quiz dans le jeu.
 * Extrait de GenericGameInteractionComponent pour simplifier la maintenance.
 */
public final class GameQuizHandler {

    private static final Logger LOGGER = LoggerFactory.getLogger(GameQuizHandler.class);

    private final GameQuizComponent quizComponent;
    private Integer localPlayerId;
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

    public void setLocalPlayerId(Integer localPlayerId) {
        this.localPlayerId = localPlayerId;
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
            next = 0;
        } else {
            next = quizChoiceIndex + delta;
            if (next < 0) next = 0;
            if (next >= size) next = size - 1;
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

        String question = normalizeText(quiz.question());
        List<String> choices = normalizeChoices(quiz.choices());
        GenericGameState.PendingQuiz normalizedQuiz = new GenericGameState.PendingQuiz(question, choices, quiz.playerId());

        LOGGER.debug("[quiz] render question={} choices={}", normalizedQuiz.question(), normalizedQuiz.choices());

        String quizKey = normalizedQuiz.question() + "|" + String.join("||", normalizedQuiz.choices());
        boolean sameQuiz = quizKey.equals(lastQuizAnnouncementKey);
        lastQuizAnnouncementKey = quizKey;
        activeQuiz = normalizedQuiz;
        quizChoiceIndex = -1;

        if (!sameQuiz) {
            lastAnnouncedQuizChoice = -1;
        }

        quizComponent.showQuiz(normalizedQuiz.question(), normalizedQuiz.choices());

        if (!sameQuiz) {
            // Annonce vocale complète pour les lecteurs d'écran
            String announcement = buildQuizAnnouncement(normalizedQuiz.question(), normalizedQuiz.choices());
            announceEvent.accept(announcement);
            updateInfoLabel.accept(buildQuizChoicesLabel(normalizedQuiz.question(), normalizedQuiz.choices()));
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

    private static String normalizeText(String text) {
        if (text == null) return "";
        // Éviter les "lignes vides 1 sur 2" quand des chaînes contiennent \r\n (Windows) ou \r,
        // et supprimer les caractères invisibles (ex: zero-width) qui peuvent créer des options vides.
        String normalized = text.replace("\r\n", "\n").replace('\r', '\n');
        normalized = stripInvisible(normalized, true);
        return collapseWhitespace(normalized).trim();
    }

    private static List<String> normalizeChoices(List<String> rawChoices) {
        if (rawChoices == null || rawChoices.isEmpty()) return List.of();
        return rawChoices.stream()
                .filter(Objects::nonNull)
                .map(s -> {
                    String normalized = s.replace("\r\n", "\n").replace('\r', '\n');
                    normalized = stripInvisible(normalized, false);
                    return collapseWhitespace(normalized).trim();
                })
                .filter(s -> !s.isBlank())
                .toList();
    }

    private static String stripInvisible(String s, boolean allowNewlines) {
        if (s == null || s.isEmpty()) return "";
        StringBuilder sb = new StringBuilder(s.length());
        for (int i = 0; i < s.length(); ) {
            int cp = s.codePointAt(i);
            i += Character.charCount(cp);
            if (!allowNewlines && cp == '\n') {
                sb.append(' ');
                continue;
            }
            // Retirer: caractères de contrôle et caractères de format (ex: U+200B ZERO WIDTH SPACE).
            int type = Character.getType(cp);
            boolean isControl = Character.isISOControl(cp) && cp != '\n' && cp != '\t';
            boolean isFormat = type == Character.FORMAT;
            if (isControl || isFormat) {
                continue;
            }
            sb.appendCodePoint(cp);
        }
        return sb.toString();
    }

    private static String collapseWhitespace(String s) {
        if (s == null || s.isEmpty()) return "";
        StringBuilder sb = new StringBuilder(s.length());
        boolean inWs = false;
        for (int i = 0; i < s.length(); ) {
            int cp = s.codePointAt(i);
            i += Character.charCount(cp);
            boolean ws = Character.isWhitespace(cp);
            if (ws) {
                if (!inWs) {
                    sb.append(' ');
                    inWs = true;
                }
            } else {
                sb.appendCodePoint(cp);
                inWs = false;
            }
        }
        return sb.toString();
    }
}
