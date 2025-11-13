package com.lemondelila.client.gamelogic.damenature.view;

import com.lemondelila.client.framework.access.game.AccessibilityService;
import com.lemondelila.client.framework.access.game.GameHistoryTracker;
import com.lemondelila.client.framework.access.game.GameHistoryView;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSession;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureState;

import javax.accessibility.AccessibleContext;
import javax.swing.BorderFactory;
import javax.swing.Box;
import javax.swing.BoxLayout;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JTextArea;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import javax.swing.border.EmptyBorder;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.awt.KeyboardFocusManager;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

final class DameNatureGameplayPanel extends JPanel {

    private final AccessibilityService accessibilityService;
    private final GameHistoryTracker historyTracker = new GameHistoryTracker();
    private final GameHistoryView historyView;

    private final JLabel turnLabel = new JLabel("Tour : -");
    private final JLabel selectionLabel = new JLabel("Sélection : aucune");
    private final JLabel statusLabel = new JLabel(" ");
    private final JTextArea instructionsArea = createReadOnlyArea(8, "Commandes disponibles");
    private final JTextArea handArea = createReadOnlyArea(8, "Votre main");
    private final JTextArea booksArea = createReadOnlyArea(4, "Familles complétées");
    private final JTextArea opponentsArea = createReadOnlyArea(6, "Adversaires");
    private final JTextArea quizArea = createReadOnlyArea(4, "Quiz en cours");

    private List<PlayerOption> playerOptions = List.of();
    private List<CardOption> cardOptions = List.of();
    private List<String> currentQuizChoices = List.of();
    private int selectedPlayerIndex = -1;
    private int selectedCardIndex = -1;

    DameNatureGameplayPanel(AccessibilityService accessibilityService) {
        this.accessibilityService = Objects.requireNonNull(accessibilityService, "accessibilityService");
        this.historyView = new GameHistoryView(
                "Historique",
                "Historique des actions",
                "Derniers évènements de la partie Dame Nature."
        );
        historyTracker.setMaxEntries(400);
        buildUi();
        initialiseInstructions();
        configureHistoryNavigation();
    }

    void reset() {
        turnLabel.setText("Tour : -");
        setSelectionDescription("Sélection : aucune");
        handArea.setText("Aucune carte en main.");
        booksArea.setText("Aucune famille complétée.");
        opponentsArea.setText("Aucun adversaire.");
        quizArea.setText("Aucun quiz en cours.");
        statusLabel.setText(" ");
        setAccessibleDescription(statusLabel, " ");
        currentQuizChoices = List.of();
        playerOptions = List.of();
        cardOptions = List.of();
        selectedPlayerIndex = -1;
        selectedCardIndex = -1;
        historyTracker.clear();
        historyView.setHistoryText("");
    }

    void applySession(DameNatureSession session) {
        DameNatureState state = session.state();
        updateTurnIndicators(state);
        updatePlayers(state, session.self());
        updateSelections(state, session.self());
        updateQuiz(state);
        updateHistory(state);
    }

    void setStatusMessage(String message) {
        statusLabel.setText(message);
        accessibilityService.announceCustom(statusLabel, message);
    }

    String cycleTarget(int delta) {
        if (playerOptions.isEmpty()) {
            selectedPlayerIndex = -1;
            setSelectionDescription("Sélection : aucun adversaire | carte " + currentCardLabel());
            return "Aucun adversaire disponible.";
        }
        selectedPlayerIndex = Math.floorMod(selectedPlayerIndex + delta, playerOptions.size());
        PlayerOption option = playerOptions.get(selectedPlayerIndex);
        updateSelectionLabel();
        return "Adversaire sélectionné : " + option.label();
    }

    String cycleCard(int delta) {
        if (cardOptions.isEmpty()) {
            selectedCardIndex = -1;
            setSelectionDescription("Sélection : adversaire " + currentPlayerLabel() + " | carte aucune");
            return "Aucune carte disponible à demander.";
        }
        selectedCardIndex = Math.floorMod(selectedCardIndex + delta, cardOptions.size());
        CardOption option = cardOptions.get(selectedCardIndex);
        updateSelectionLabel();
        return "Carte sélectionnée : " + option.label();
    }

    Optional<PlayerOption> selectedPlayer() {
        if (selectedPlayerIndex < 0 || selectedPlayerIndex >= playerOptions.size()) {
            return Optional.empty();
        }
        return Optional.of(playerOptions.get(selectedPlayerIndex));
    }

    Optional<CardOption> selectedCard() {
        if (selectedCardIndex < 0 || selectedCardIndex >= cardOptions.size()) {
            return Optional.empty();
        }
        return Optional.of(cardOptions.get(selectedCardIndex));
    }

    List<String> currentQuizChoices() {
        return currentQuizChoices;
    }

    JLabel turnLabel() {
        return turnLabel;
    }

    GameHistoryView historyView() {
        return historyView;
    }

    JTextArea historyComponent() {
        return historyView.historyComponent();
    }

    String currentSelectionAnnouncement() {
        String description = "Sélection : adversaire " + currentPlayerLabel() + " | carte " + currentCardLabel();
        setSelectionDescription(description);
        return description;
    }

    private void buildUi() {
        setOpaque(false);
        setLayout(new BorderLayout(16, 16));

        JPanel header = new JPanel();
        header.setOpaque(false);
        header.setLayout(new BoxLayout(header, BoxLayout.Y_AXIS));
        turnLabel.setFont(turnLabel.getFont().deriveFont(20f));
        turnLabel.setAlignmentX(LEFT_ALIGNMENT);
        setAccessibleName(turnLabel, "Tour en cours");
        selectionLabel.setAlignmentX(LEFT_ALIGNMENT);
        setAccessibleName(selectionLabel, "Sélection courante");
        setAccessibleDescription(selectionLabel, "Sélection : aucune");
        header.add(turnLabel);
        header.add(Box.createRigidArea(new Dimension(0, 6)));
        header.add(selectionLabel);
        header.add(Box.createRigidArea(new Dimension(0, 12)));
        add(header, BorderLayout.NORTH);

        JPanel center = new JPanel();
        center.setOpaque(false);
        center.setLayout(new BoxLayout(center, BoxLayout.X_AXIS));

        JPanel infoPanel = new JPanel();
        infoPanel.setOpaque(false);
        infoPanel.setLayout(new BoxLayout(infoPanel, BoxLayout.Y_AXIS));
        infoPanel.add(section("Commandes", wrap(instructionsArea, 320, 140)));
        infoPanel.add(Box.createRigidArea(new Dimension(0, 12)));
        infoPanel.add(section("Votre main", wrap(handArea, 320, 160)));
        infoPanel.add(Box.createRigidArea(new Dimension(0, 12)));
        infoPanel.add(section("Familles complétées", wrap(booksArea, 320, 120)));
        infoPanel.add(Box.createRigidArea(new Dimension(0, 12)));
        infoPanel.add(section("Adversaires", wrap(opponentsArea, 320, 140)));
        infoPanel.add(Box.createRigidArea(new Dimension(0, 12)));
        infoPanel.add(section("Quiz en cours", wrap(quizArea, 320, 140)));

        center.add(infoPanel);
        center.add(Box.createRigidArea(new Dimension(16, 0)));

        historyView.setPreferredSize(new Dimension(420, 380));
        center.add(historyView);

        add(center, BorderLayout.CENTER);

        statusLabel.setBorder(new EmptyBorder(8, 0, 0, 0));
        setAccessibleName(statusLabel, "Statut de la partie");
        add(statusLabel, BorderLayout.SOUTH);
    }

    private void initialiseInstructions() {
        instructionsArea.setLineWrap(true);
        instructionsArea.setWrapStyleWord(true);
        instructionsArea.setBorder(new EmptyBorder(4, 6, 4, 6));
        setAccessibleDescription(instructionsArea, """
                Entrée pour piocher, flèches pour sélectionner les adversaires et cartes, E pour demander, R rafraîchit, T annonce le tour, W annonce les joueurs présents, C ouvre la configuration, chiffres 1-9 répondent au quiz, Tab va à l'historique, Q ouvre la confirmation de sortie.
                """);
        instructionsArea.setText("""
                Entrée : piocher.
                Flèches haut / bas : changer d'adversaire.
                Flèches gauche / droite : changer la carte à demander.
                E : demander la carte sélectionnée.
                R : actualiser la partie.
                T : annoncer le tour en cours.
                W : annoncer les joueurs autour de la table.
                C : ouvrir la configuration et relancer la partie.
                1-9 : répondre à un quiz.
                Tab : aller à l'historique, Maj+Tab pour revenir.
                Q : quitter la partie après confirmation.
                """);
        instructionsArea.setCaretPosition(0);
    }

    private void configureHistoryNavigation() {
        JTextArea historyArea = historyComponent();
        disableTabTraversal(historyArea);
        historyArea.getInputMap(WHEN_FOCUSED).put(KeyStroke.getKeyStroke("shift TAB"), "history-exit");
        historyArea.getActionMap().put("history-exit", new javax.swing.AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                SwingUtilities.invokeLater(() -> DameNatureGameplayPanel.this.requestFocusInWindow());
            }
        });
    }

    private void updateTurnIndicators(DameNatureState state) {
        List<DameNatureState.Player> players = state.players();
        if (!players.isEmpty() && state.turnIndex() >= 0 && state.turnIndex() < players.size()) {
            DameNatureState.Player current = players.get(state.turnIndex());
            turnLabel.setText("Tour : " + formatPlayerName(current));
        } else {
            turnLabel.setText("Tour : -");
        }
    }

    private void updatePlayers(DameNatureState state, DameNatureState.Player self) {
        if (self != null) {
            StringBuilder handBuilder = new StringBuilder();
            self.hand().forEach(card -> handBuilder.append("• ").append(card).append('\n'));
            handArea.setText(handBuilder.isEmpty() ? "Aucune carte en main." : handBuilder.toString());
            setAccessibleDescription(handArea, handArea.getText());

            if (!self.books().isEmpty()) {
                StringBuilder booksBuilder = new StringBuilder();
                state.catalog().families().stream()
                        .filter(family -> self.books().contains(family.id()))
                        .sorted(Comparator.comparing(DameNatureState.Family::name))
                        .forEach(family -> booksBuilder.append("• ").append(family.name()).append('\n'));
                booksArea.setText(booksBuilder.toString());
            } else {
                booksArea.setText("Aucune famille complétée.");
            }
            setAccessibleDescription(booksArea, booksArea.getText());
        } else {
            handArea.setText("Rejoignez la partie pour consulter votre main.");
            booksArea.setText("Aucune information disponible.");
            setAccessibleDescription(handArea, handArea.getText());
            setAccessibleDescription(booksArea, booksArea.getText());
        }

        StringBuilder opponentsBuilder = new StringBuilder();
        state.players().forEach(player -> {
            opponentsBuilder.append("• ")
                    .append(formatPlayerName(player))
                    .append(" - cartes : ").append(player.handCount())
                    .append(" - familles : ").append(player.books().size());
            if (state.turnIndex() == state.players().indexOf(player)) {
                opponentsBuilder.append(" (au tour)");
            }
            opponentsBuilder.append('\n');
        });
        opponentsArea.setText(opponentsBuilder.isEmpty() ? "Aucun adversaire." : opponentsBuilder.toString());
        setAccessibleDescription(opponentsArea, opponentsArea.getText());
    }

    private void updateSelections(DameNatureState state, DameNatureState.Player self) {
        if (self == null) {
            playerOptions = List.of();
            cardOptions = List.of();
            selectedPlayerIndex = -1;
            selectedCardIndex = -1;
            updateSelectionLabel();
            return;
        }

        playerOptions = state.players().stream()
                .filter(player -> player.id() != self.id())
                .map(player -> new PlayerOption(player.id(), player.username(), player.handCount(), player.isBot()))
                .toList();
        if (playerOptions.isEmpty()) {
            selectedPlayerIndex = -1;
        } else if (selectedPlayerIndex < 0) {
            selectedPlayerIndex = 0;
        } else {
            selectedPlayerIndex = Math.min(selectedPlayerIndex, playerOptions.size() - 1);
        }

        List<String> ownedCodes = self.hand().stream().map(DameNatureState.HandCard::code).toList();
        List<CardOption> available = new ArrayList<>();
        for (DameNatureState.Family family : state.catalog().families()) {
            boolean ownsFamilyCard = self.hand().stream().anyMatch(card ->
                    family.id().equalsIgnoreCase(card.familyId()));
            if (!ownsFamilyCard) {
                continue;
            }
            for (DameNatureState.FamilyMember member : family.members()) {
                boolean alreadyOwned = ownedCodes.stream().anyMatch(code -> {
                    DameNatureState.CardDefinition def = state.cards().get(code);
                    return def != null
                            && family.id().equalsIgnoreCase(def.familyId())
                            && member.id().equalsIgnoreCase(def.memberId());
                });
                if (!alreadyOwned) {
                    available.add(new CardOption(family.id(), family.name(), member.id(), member.name()));
                }
            }
        }
        cardOptions = available;
        if (cardOptions.isEmpty()) {
            selectedCardIndex = -1;
        } else if (selectedCardIndex < 0) {
            selectedCardIndex = 0;
        } else {
            selectedCardIndex = Math.min(selectedCardIndex, cardOptions.size() - 1);
        }

        updateSelectionLabel();
    }

    private void updateQuiz(DameNatureState state) {
        DameNatureState.PendingQuiz quiz = state.pendingQuiz();
        if (quiz != null && quiz.active()) {
            currentQuizChoices = List.copyOf(quiz.choices());
            StringBuilder builder = new StringBuilder();
            builder.append(quiz.question()).append('\n');
            for (int i = 0; i < currentQuizChoices.size(); i++) {
                builder.append(i + 1).append(") ").append(currentQuizChoices.get(i)).append('\n');
            }
            quizArea.setText(builder.toString());
        } else {
            currentQuizChoices = List.of();
            quizArea.setText("Aucun quiz en cours.");
        }
        quizArea.setCaretPosition(0);
        setAccessibleDescription(quizArea, quizArea.getText());
    }

    private void updateHistory(DameNatureState state) {
        historyTracker.clear();
        if (state != null && state.log() != null) {
            historyTracker.setEntries(state.log().stream()
                    .map(DameNatureState.LogEntry::message)
                    .filter(Objects::nonNull)
                    .map(String::trim)
                    .filter(msg -> !msg.isEmpty())
                    .toList());
        }
        historyView.render(historyTracker, "Aucun évènement pour le moment.");
        historyComponent().setCaretPosition(historyComponent().getDocument().getLength());
    }

    private void updateSelectionLabel() {
        String description = "Sélection : adversaire " + currentPlayerLabel() + " | carte " + currentCardLabel();
        setSelectionDescription(description);
        accessibilityService.announceCustom(selectionLabel, description);
    }

    private String currentPlayerLabel() {
        if (selectedPlayerIndex < 0 || selectedPlayerIndex >= playerOptions.size()) {
            return "aucun adversaire";
        }
        return playerOptions.get(selectedPlayerIndex).label();
    }

    private String currentCardLabel() {
        if (selectedCardIndex < 0 || selectedCardIndex >= cardOptions.size()) {
            return "aucune carte";
        }
        return cardOptions.get(selectedCardIndex).label();
    }

    private String formatPlayerName(DameNatureState.Player player) {
        if (player == null) {
            return "";
        }
        return decorateBot(player.username(), player.isBot());
    }

    private static String decorateBot(String base, boolean isBot) {
        if (base == null || base.isBlank()) {
            return isBot ? "Bot" : "";
        }
        return isBot ? base + " (bot)" : base;
    }

    private void setSelectionDescription(String description) {
        selectionLabel.setText(description);
        setAccessibleDescription(selectionLabel, description);
    }

    private static JTextArea createReadOnlyArea(int rows, String accessibleName) {
        JTextArea area = new JTextArea(rows, 32);
        area.setEditable(false);
        area.setLineWrap(true);
        area.setWrapStyleWord(true);
        area.setBorder(BorderFactory.createEmptyBorder(4, 6, 4, 6));
        area.getAccessibleContext().setAccessibleName(accessibleName);
        return area;
    }

    private JScrollPane wrap(JTextArea area, int width, int height) {
        JScrollPane scroll = new JScrollPane(area);
        scroll.setBorder(BorderFactory.createEmptyBorder());
        scroll.setPreferredSize(new Dimension(width, height));
        return scroll;
    }

    private JPanel section(String title, JScrollPane content) {
        JPanel section = new JPanel(new BorderLayout());
        section.setOpaque(false);
        section.setBorder(BorderFactory.createTitledBorder(title));
        section.add(content, BorderLayout.CENTER);
        return section;
    }

    private static void disableTabTraversal(JTextArea component) {
        component.setFocusTraversalKeys(KeyboardFocusManager.FORWARD_TRAVERSAL_KEYS, Collections.emptySet());
        component.setFocusTraversalKeys(KeyboardFocusManager.BACKWARD_TRAVERSAL_KEYS, Collections.emptySet());
    }

    private void setAccessibleName(JComponent component, String name) {
        AccessibleContext context = component.getAccessibleContext();
        if (context != null) {
            String safe = name == null ? "" : name;
            String old = context.getAccessibleName();
            if (!safe.equals(old)) {
                context.setAccessibleName(safe);
                context.firePropertyChange(AccessibleContext.ACCESSIBLE_NAME_PROPERTY, old, safe);
            }
        }
    }

    private void setAccessibleDescription(JComponent component, String description) {
        AccessibleContext context = component.getAccessibleContext();
        if (context != null) {
            String safe = description == null ? "" : description;
            String old = context.getAccessibleDescription();
            if (!safe.equals(old)) {
                context.setAccessibleDescription(safe);
                context.firePropertyChange(AccessibleContext.ACCESSIBLE_DESCRIPTION_PROPERTY, old, safe);
            }
        }
    }

    static record PlayerOption(int id, String name, int handCount, boolean bot) {
        String label() {
            return displayName() + " (" + handCount + " cartes)";
        }

        String displayName() {
            return name == null ? "" : (bot ? name + " (bot)" : name);
        }
    }

    static record CardOption(String familyId, String familyName, String memberId, String memberName) {
        String label() {
            return familyName + " - " + memberName;
        }
    }
}
