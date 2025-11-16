package com.lemondelila.client.gamelogic.panierexpress.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.game.GameHistorySidebar;
import com.lemondelila.client.framework.access.game.GameHistoryTracker;

import javax.accessibility.AccessibleContext;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.util.List;

/**
 * Vue principale de la partie Panier Express.
 */
public final class PanierExpressGamePanel extends JPanel {

    private final JLabel statusLabel = new JLabel("Partie en pr?paration...");
    private final JLabel pendingLabel = new JLabel(" ");
    private final GameHistorySidebar historySidebar = new GameHistorySidebar(
            "Historique",
            "Historique des actions",
            "Liste des derniers ?v??nements de la partie.",
            new Dimension(320, 400)
    );

    private final JPanel quizPanel = new JPanel();
    private final JLabel quizQuestionLabel = new JLabel(" ");
    private final JTextArea quizChoicesArea = new JTextArea();

    private final JTextArea yourProgressArea = createReadOnlyArea("Votre progression");
    private final JTextArea playersArea = createReadOnlyArea("Progression des joueurs");
    private final JTextArea scoreArea = createReadOnlyArea("Score en cours");
    private boolean accessibleToggle;

    PanierExpressGamePanel() {
        super(new BorderLayout(16, 16));
        setBorder(BorderFactory.createEmptyBorder(24, 32, 24, 32));
        setFocusable(true);
        setRequestFocusEnabled(true);
        setFocusTraversalKeysEnabled(false);
        buildUi();
    }

    private void buildUi() {
        JPanel leftColumn = new JPanel();
        leftColumn.setOpaque(false);
        leftColumn.setLayout(new BoxLayout(leftColumn, BoxLayout.Y_AXIS));

        statusLabel.setAlignmentX(Component.LEFT_ALIGNMENT);
        statusLabel.setFocusable(false);
        AccessibleDecorator.apply(statusLabel, AccessibleSpec.builder()
                .name("Statut de la partie")
                .description("Informations générales sur l'état du tour en cours.")
                .build());
        leftColumn.add(statusLabel);

        leftColumn.add(Box.createRigidArea(new Dimension(0, 8)));
        pendingLabel.setAlignmentX(Component.LEFT_ALIGNMENT);
        pendingLabel.setFocusable(false);
        AccessibleDecorator.apply(pendingLabel, AccessibleSpec.builder()
                .name("Informations de tour")
                .description("Indications supplémentaires sur les actions attendues.")
                .build());
        leftColumn.add(pendingLabel);

        leftColumn.add(Box.createRigidArea(new Dimension(0, 12)));
        buildQuizPanel();
        leftColumn.add(quizPanel);

        leftColumn.add(Box.createRigidArea(new Dimension(0, 12)));
        leftColumn.add(wrap(yourProgressArea, "Votre progression"));
        leftColumn.add(Box.createRigidArea(new Dimension(0, 12)));
        leftColumn.add(wrap(playersArea, "Progression des joueurs"));
        leftColumn.add(Box.createRigidArea(new Dimension(0, 12)));
        leftColumn.add(wrap(scoreArea, "Score en cours"));

        add(leftColumn, BorderLayout.CENTER);

        add(historySidebar, BorderLayout.EAST);
    }

    private void buildQuizPanel() {
        quizPanel.setLayout(new BoxLayout(quizPanel, BoxLayout.Y_AXIS));
        quizPanel.setBorder(BorderFactory.createTitledBorder("Quiz"));
        quizPanel.setAlignmentX(Component.LEFT_ALIGNMENT);
        quizPanel.setVisible(false);
        AccessibleDecorator.apply(quizQuestionLabel, AccessibleSpec.builder()
                .name("Question de quiz")
                .description("Texte de la question actuellement posée.")
                .build());
        quizQuestionLabel.setAlignmentX(Component.LEFT_ALIGNMENT);
        quizPanel.add(quizQuestionLabel);

        quizPanel.add(Box.createRigidArea(new Dimension(0, 6)));
        quizChoicesArea.setEditable(false);
        quizChoicesArea.setLineWrap(true);
        quizChoicesArea.setWrapStyleWord(true);
        quizChoicesArea.setFocusable(false);
        AccessibleDecorator.apply(quizChoicesArea, AccessibleSpec.builder()
                .name("Choix du quiz")
                .description("Réponses possibles à la question du quiz.")
                .build());
        quizPanel.add(wrap(quizChoicesArea, null));
    }

    private static JTextArea createReadOnlyArea(String accessibleName) {
        JTextArea area = new JTextArea();
        area.setEditable(false);
        area.setLineWrap(true);
        area.setWrapStyleWord(true);
        area.setFocusable(false);
        AccessibleDecorator.apply(area, AccessibleSpec.builder()
                .name(accessibleName)
                .description("Informations détaillées : " + accessibleName.toLowerCase() + '.')
                .build());
        return area;
    }

    private JScrollPane wrap(JTextArea area, String title) {
        JScrollPane scroll = new JScrollPane(area);
        if (title != null && !title.isBlank()) {
            scroll.setBorder(BorderFactory.createTitledBorder(title));
        } else {
            scroll.setBorder(BorderFactory.createEmptyBorder());
        }
        scroll.setAlignmentX(Component.LEFT_ALIGNMENT);
        scroll.setPreferredSize(new Dimension(320, 140));
        return scroll;
    }

    public void updateStatus(String text, String accessibleDescription) {
        statusLabel.setText(text);
        if (accessibleDescription != null) {
            statusLabel.getAccessibleContext().setAccessibleDescription(accessibleDescription);
        }
    }

    public void updatePending(String text) {
        pendingLabel.setText(text == null ? " " : text);
        pendingLabel.getAccessibleContext().setAccessibleDescription(pendingLabel.getText());
    }

    public void showQuiz(String question, List<String> choices) {
        quizPanel.setVisible(true);
        quizQuestionLabel.setText(question == null ? " " : question);
        StringBuilder builder = new StringBuilder();
        if (choices != null) {
            for (int i = 0; i < choices.size(); i++) {
                builder.append("Touche ").append(i + 1).append(" : ").append(choices.get(i)).append('\n');
            }
        }
        String text = builder.toString().strip();
        quizChoicesArea.setText(text);
        quizChoicesArea.getAccessibleContext().setAccessibleDescription(text);
    }

    public void hideQuiz() {
        quizPanel.setVisible(false);
        quizQuestionLabel.setText(" ");
        quizChoicesArea.setText("");
        quizChoicesArea.getAccessibleContext().setAccessibleDescription("");
    }

    public void updateYourProgress(String text) {
        yourProgressArea.setText(text == null ? "" : text);
        yourProgressArea.getAccessibleContext().setAccessibleDescription(yourProgressArea.getText());
    }

    public void updatePlayers(String text) {
        playersArea.setText(text == null ? "" : text);
        playersArea.getAccessibleContext().setAccessibleDescription(playersArea.getText());
    }

    public void updateScore(String text) {
        scoreArea.setText(text == null ? "" : text);
        scoreArea.getAccessibleContext().setAccessibleDescription(scoreArea.getText());
    }

    public void focusMain() {
        requestFocusInWindow();
    }

    public void focusHistory() {
        historySidebar.focusHistory();
    }

    public void updateHistory(GameHistoryTracker tracker, String emptyMessage) {
        historySidebar.render(tracker, emptyMessage);
    }

    public void announceScore(String message) {
        fireAccessibleText(scoreArea, message);
    }

    public void announceBasket(String message) {
        fireAccessibleText(yourProgressArea, message);
    }

    public AccessibleContext statusAccessibleContext() {
        return statusLabel.getAccessibleContext();
    }

    private void fireAccessibleText(JComponent component, String message) {
        if (component == null || message == null || message.isBlank()) {
            return;
        }
        AccessibleContext context = component.getAccessibleContext();
        if (context == null) {
            return;
        }
        String payload = accessibleToggle ? message + "\u200B" : message;
        accessibleToggle = !accessibleToggle;
        Runnable fire = () -> {
            context.setAccessibleDescription("");
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_TEXT_PROPERTY,
                    null,
                    ""
            );
            context.setAccessibleDescription(payload);
            context.firePropertyChange(
                    AccessibleContext.ACCESSIBLE_TEXT_PROPERTY,
                    null,
                    payload
            );
        };
        if (SwingUtilities.isEventDispatchThread()) {
            fire.run();
        } else {
            SwingUtilities.invokeLater(fire);
        }
    }
}


