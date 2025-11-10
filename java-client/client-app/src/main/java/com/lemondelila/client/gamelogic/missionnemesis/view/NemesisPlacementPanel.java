package com.lemondelila.client.gamelogic.missionnemesis.view;

import javax.accessibility.AccessibleContext;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JPanel;
import java.awt.Color;
import java.awt.Font;

/**
 * Panneau d'aide contextuelle affiche au-dessus des grilles.
 * Fournit des indications pour le placement manuel et le deroulement du combat.
 */
final class NemesisPlacementPanel extends JPanel {

    private final JLabel headline = new JLabel(" ");
    private final JLabel detail = new JLabel(" ");
    private final JLabel hint = new JLabel(" ");

    NemesisPlacementPanel() {
        setLayout(new BoxLayout(this, BoxLayout.Y_AXIS));
        setOpaque(true);
        setBackground(new Color(235, 242, 252));
        setBorder(javax.swing.BorderFactory.createEmptyBorder(12, 12, 12, 12));
        getAccessibleContext().setAccessibleName("Indications de placement Mission Nemesis");

        headline.setFont(headline.getFont().deriveFont(Font.BOLD, 16f));
        detail.setFont(detail.getFont().deriveFont(Font.PLAIN, 14f));
        hint.setFont(hint.getFont().deriveFont(Font.PLAIN, 13f));
        hint.setForeground(new Color(60, 80, 115));

        headline.setAlignmentX(LEFT_ALIGNMENT);
        detail.setAlignmentX(LEFT_ALIGNMENT);
        hint.setAlignmentX(LEFT_ALIGNMENT);

        add(headline);
        add(Box.createVerticalStrut(6));
        add(detail);
        add(Box.createVerticalStrut(6));
        add(hint);

        setVisible(false);
    }

    void showManualIntro(int shipsCount) {
        setVisible(true);
        headline.setText("Placement manuel de la flotte");
        detail.setText("Vous devez placer " + shipsCount + " vaisseaux sans chevauchement.");
        hint.setText("Deplacez-vous avec les fleches, validez chaque segment avec Entree, annulez avec Retour arriere.");
        announce("Placement manuel. " + shipsCount + " vaisseaux a positionner.");
    }

    void updateManualProgress(String shipName,
                              int shipIndex,
                              int totalShips,
                              int placedSegments,
                              int shipSize) {
        setVisible(true);
        headline.setText("Vaisseau " + shipIndex + "/" + totalShips + " : " + shipName + " (" + shipSize + ")");
        detail.setText("Segments places : " + placedSegments + " / " + shipSize);
        hint.setText("Utilisez les fleches pour cibler une case libre, Entree pour valider. Retour arriere supprime le dernier segment.");
        announce("Vaisseau " + shipIndex + " sur " + totalShips + " : " + shipName + ", " + placedSegments + " segments sur " + shipSize);
    }

    void showManualComplete() {
        setVisible(true);
        headline.setText("Flotte validee");
        detail.setText("Transmission du placement au serveur...");
        hint.setText("Patientez quelques instants, la phase de combat va debuter.");
        announce("Flotte validee. Transmission du placement en cours.");
    }

    void showAutoPlacementMessage() {
        setVisible(true);
        headline.setText("Placement automatique");
        detail.setText("Votre flotte est en cours de positionnement automatique.");
        hint.setText("Aucun deplacement requis. Vous recevrez un message des que le combat sera pret.");
        announce("Placement automatique en cours.");
    }

    void showCombatHelp() {
        setVisible(true);
        headline.setText("Phase de combat");
        detail.setText("Selectionnez la case de tir avec les fleches et pressez Entree pour tirer.");
        hint.setText("Les cases deja visees sont ignorees automatiquement.");
        announce("Phase de combat. Selectionnez une case et validez avec Entree pour tirer.");
    }

    void clear() {
        setVisible(false);
        headline.setText(" ");
        detail.setText(" ");
        hint.setText(" ");
        announce("Indications masquees.");
    }

    private void announce(String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        AccessibleContext context = getAccessibleContext();
        if (context != null) {
            String oldDescription = context.getAccessibleDescription();
            String oldName = context.getAccessibleName();
            context.setAccessibleName(message);
            context.setAccessibleDescription(message);
            context.firePropertyChange(AccessibleContext.ACCESSIBLE_NAME_PROPERTY, oldName, message);
            context.firePropertyChange(AccessibleContext.ACCESSIBLE_DESCRIPTION_PROPERTY, oldDescription, message);
        }
    }
}
