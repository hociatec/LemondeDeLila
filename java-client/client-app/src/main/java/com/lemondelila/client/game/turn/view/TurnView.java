package com.lemondelila.client.game.turn.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;
import com.lemondelila.client.game.turn.model.TurnState;

import javax.swing.JLabel;
import javax.swing.JPanel;
import java.awt.BorderLayout;
import java.util.Objects;

/**
 * Vue optionnelle affichant le tour courant (round, index, direction).
 * À intégrer dans un écran au besoin.
 */
public final class TurnView extends JPanel {

    private final JLabel label = new JLabel("Tour en cours");

    public TurnView(FocusHighlighter highlighter) {
        super(new BorderLayout());
        Objects.requireNonNull(highlighter, "highlighter");
        AccessibleDecorator.apply(label, AccessibleSpec.builder()
                .name("Tour en cours")
                .description("Informations sur le joueur actif")
                .build());
        highlighter.apply(label);
        add(label, BorderLayout.CENTER);
    }

    public void render(TurnState turn) {
        if (turn == null) {
            label.setText("Tour en cours");
            return;
        }
        label.setText("Round " + turn.round() + " — Joueur " + turn.index() + " — " + turn.directionLabel());
    }
}
