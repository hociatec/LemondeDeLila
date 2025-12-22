package com.lemondelila.client.game.room.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.game.history.view.GameHistorySidebar;
import com.lemondelila.client.game.turn.view.TurnView;

import javax.swing.BorderFactory;
import javax.swing.JLabel;
import javax.swing.JPanel;
import java.awt.BorderLayout;
import java.util.Objects;

/**
 * Vue composant pour l'�cran de table (en-t�te, zone de jeu, historique).
 */
public final class RoomTableView extends JPanel {

    private final JPanel interactionPanel = new JPanel(new BorderLayout(8, 8));
    private final JLabel header = new JLabel();
    private final JLabel interactionTitle = new JLabel();
    private final GameHistorySidebar historySidebar;
    private final TurnView turnView;

    public RoomTableView(FocusHighlighter focusHighlighter, GameHistorySidebar historySidebar) {
        super(new BorderLayout(8, 8));
        this.historySidebar = Objects.requireNonNull(historySidebar, "historySidebar");
        this.turnView = new TurnView(focusHighlighter);
        buildUi(focusHighlighter);
    }

    private void buildUi(FocusHighlighter focusHighlighter) {
        interactionPanel.setFocusable(true);
        AccessibleDecorator.apply(interactionPanel, AccessibleSpec.builder()
                .name("Zone de jeu")
                .description("Zone principale du jeu")
                .build());
        focusHighlighter.apply(interactionPanel);
        focusHighlighter.apply(historySidebar);

        JPanel left = new JPanel(new BorderLayout());
        left.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        JPanel titles = new JPanel(new java.awt.GridLayout(2, 1));
        titles.add(header);
        titles.add(interactionTitle);
        left.add(titles, BorderLayout.NORTH);
        left.add(turnView, BorderLayout.SOUTH);
        left.add(interactionPanel, BorderLayout.CENTER);

        add(left, BorderLayout.CENTER);
        add(historySidebar, BorderLayout.EAST);
    }

    public JPanel interactionPanel() {
        return interactionPanel;
    }

    public JLabel headerLabel() {
        return header;
    }

    public JLabel interactionTitle() {
        return interactionTitle;
    }

    public GameHistorySidebar historySidebar() {
        return historySidebar;
    }

    public javax.swing.JComponent historyComponent() {
        return historySidebar.historyComponent();
    }

    public void renderHistory(com.lemondelila.client.game.history.controller.GameHistoryController controller) {
        historySidebar.render(controller.tracker(), "Pas encore d'evenement.");
    }

    public void focusInteraction() {
        interactionPanel.requestFocusInWindow();
    }

    public TurnView turnView() {
        return turnView;
    }
}
