package com.lemondelila.client.game.turn.view;

import com.lemondelila.client.framework.access.AccessibleDecorator;
import com.lemondelila.client.framework.access.AccessibleSpec;
import com.lemondelila.client.framework.access.FocusHighlighter;

import javax.swing.JLabel;
import javax.swing.JPanel;
import java.awt.GridLayout;
import java.util.Objects;

/**
 * En-tête générique pour une table de jeu (statut, tour, dernier lancer).
 */
public final class GameStatusPanel extends JPanel {

    private final JLabel statusLabel = new JLabel();
    private final JLabel turnLabel = new JLabel();
    private final JLabel rollLabel = new JLabel();

    public GameStatusPanel(FocusHighlighter focusHighlighter) {
        super(new GridLayout(3, 1));
        Objects.requireNonNull(focusHighlighter, "focusHighlighter");
        AccessibleDecorator.apply(this, AccessibleSpec.builder()
                .name("Statut de la partie")
                .description("Informations sur la partie en cours")
                .build());
        focusHighlighter.apply(this);
        add(statusLabel);
        add(turnLabel);
        add(rollLabel);
    }

    public void update(String status, String phase, int round, int turnIndex, Integer lastRoll) {
        statusLabel.setText("Statut : " + nullTo(status) + " | Phase : " + nullTo(phase));
        turnLabel.setText("Tour " + Math.max(1, round) + " - Joueur actif #" + Math.max(0, turnIndex));
        rollLabel.setText(lastRoll == null ? "Dernier lancer : n/a" : "Dernier lancer : " + lastRoll);
    }

    private static String nullTo(String v) {
        return v == null ? "n/a" : v;
    }
}
