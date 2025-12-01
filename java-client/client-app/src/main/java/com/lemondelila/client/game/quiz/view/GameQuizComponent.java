package com.lemondelila.client.game.quiz.view;

import javax.swing.JComponent;
import java.util.List;

/**
 * Contrat pour un composant quiz injectable dans la zone de jeu.
 */
public interface GameQuizComponent {

    /**
     * Composant Swing à afficher sur l'écran de jeu.
     */
    JComponent getComponent();

    /**
     * Affiche la question et les choix associés.
     */
    void showQuiz(String question, List<String> choices);

    /**
     * Masque ou réinitialise le quiz.
     */
    void clearQuiz();

    /**
     * Met en évidence un choix dans la liste.
     */
    void highlightChoice(int index);
}
