package com.lemondelila.client.game.turn.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.game.turn.model.TurnState;

import javax.swing.JLabel;
import javax.swing.JPanel;
import java.awt.BorderLayout;

/**
 * Widget d'affichage du statut de tour (round, joueur actif, sens, dernier dé).
 */
public final class TurnStatusPanel extends JPanel {

    private final JLabel label = new JLabel("Statut");

    public TurnStatusPanel(FocusHighlighter highlighter) {
        super(new BorderLayout());
        AccessibleDecorator.apply(label, AccessibleSpec.builder()
                .name("Statut de tour")
                .description("Informations sur le tour en cours")
                .build());
        highlighter.apply(label);
        add(label, BorderLayout.CENTER);
    }

    public void render(TurnState turn, Integer lastRoll) {
        if (turn == null) {
            label.setText("Statut: n/a");
            return;
        }
        String roll = lastRoll == null ? "" : " — Dernier dé: " + lastRoll;
        String playerIndex = turn.index() < 0 ? "?" : Integer.toString(turn.index());
        label.setText("Round " + turn.round() + " — Joueur " + playerIndex + " — " + turn.directionLabel() + roll);
    }
}
