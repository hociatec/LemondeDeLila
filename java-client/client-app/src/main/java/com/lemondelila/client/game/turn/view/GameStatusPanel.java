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
        clear();
    }

    public void update(String status, String phase, int round, int turnIndex, Integer lastRoll) {
        statusLabel.setText("Statut : " + formatStatus(status) + " | Phase : " + formatPhase(phase));
        if (round <= 0 && turnIndex <= 0) {
            turnLabel.setText("Tour : en attente");
        } else {
            turnLabel.setText("Tour " + Math.max(1, round) + " - Joueur actif #" + Math.max(1, turnIndex));
        }
        rollLabel.setText(lastRoll == null ? "Dernier lancer : n/a" : "Dernier lancer : " + lastRoll);
        setVisible(true);
    }

    public void clear() {
        statusLabel.setText("Statut : en attente | Phase : n/a");
        turnLabel.setText("Tour : en attente");
        rollLabel.setText("Dernier lancer : n/a");
        setVisible(false);
    }

    private static String formatStatus(String status) {
        if (status == null || status.isBlank()) {
            return "en attente";
        }
        String value = status.trim().toLowerCase();
        if ("open".equals(value)) {
            return "en attente";
        }
        if ("setup".equals(value) || "pending".equals(value) || "preparing".equals(value)) {
            return "preparation";
        }
        if ("running".equals(value)) {
            return "partie en cours";
        }
        if ("finished".equals(value)) {
            return "partie terminee";
        }
        return status;
    }

    private static String formatPhase(String phase) {
        if (phase == null || phase.isBlank()) {
            return "n/a";
        }
        return phase;
    }
}
