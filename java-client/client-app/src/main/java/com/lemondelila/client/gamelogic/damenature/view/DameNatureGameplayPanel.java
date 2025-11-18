package com.lemondelila.client.gamelogic.damenature.view;

import com.lemondelila.client.application.Internationalization;
import com.lemondelila.client.framework.access.game.AccessibilityService;
import com.lemondelila.client.framework.access.game.GameHistorySidebar;
import com.lemondelila.client.framework.access.game.GameHistoryTracker;
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
    private final GameHistorySidebar historySidebar;

    private final JLabel turnLabel = new JLabel(t("damenature.game.turn.default"));
    private final JLabel selectionLabel = new JLabel(t("damenature.game.selection.default"));
    private final JLabel statusLabel = new JLabel(" ");
    private final JTextArea instructionsArea = createReadOnlyArea(8, "damenature.game.instructions.name");
    private final JTextArea handArea = createReadOnlyArea(8, "damenature.game.hand.name");
    private final JTextArea booksArea = createReadOnlyArea(4, "damenature.game.books.name");
    private final JTextArea opponentsArea = createReadOnlyArea(6, "damenature.game.opponents.name");
    private final JTextArea quizArea = createReadOnlyArea(4, "damenature.game.quiz.name");

    private List<PlayerOption> playerOptions = List.of();
    private List<CardOption> cardOptions = List.of();
    private List<String> currentQuizChoices = List.of();
    private int selectedPlayerIndex = -1;
    private int selectedCardIndex = -1;

    DameNatureGameplayPanel(AccessibilityService accessibilityService) {
        this.accessibilityService = Objects.requireNonNull(accessibilityService, "accessibilityService");
        this.historySidebar = new GameHistorySidebar(
                t("damenature.game.history.title"),
                t("damenature.game.history.name"),
                t("damenature.game.history.desc"),
                new Dimension(420, 380)
        );
        historyTracker.setMaxEntries(400);
        buildUi();
        initialiseInstructions();
        configureHistoryNavigation();
    }

    void reset() {
        turnLabel.setText(t("damenature.game.turn.default"));
        setSelectionDescription(t("damenature.game.selection.default"));
        handArea.setText(t("damenature.game.hand.empty"));
        booksArea.setText(t("damenature.game.books.empty"));
        opponentsArea.setText(t("damenature.game.opponents.empty"));
        quizArea.setText(t("damenature.game.quiz.none"));
        statusLabel.setText(" ");
        setAccessibleDescription(statusLabel, " ");
        currentQuizChoices = List.of();
        playerOptions = List.of();
        cardOptions = List.of();
        selectedPlayerIndex = -1;
        selectedCardIndex = -1;
        historyTracker.clear();
        historySidebar.clear();
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
            setSelectionDescription(t("damenature.game.selection.no.player", currentCardLabel()));
            return t("damenature.game.selection.no.player.message");
        }
        selectedPlayerIndex = Math.floorMod(selectedPlayerIndex + delta, playerOptions.size());
        PlayerOption option = playerOptions.get(selectedPlayerIndex);
        updateSelectionLabel();
        return t("damenature.game.selection.player.selected", option.label());
    }

    String cycleCard(int delta) {
        if (cardOptions.isEmpty()) {
            selectedCardIndex = -1;
            setSelectionDescription(t("damenature.game.selection.no.card", currentPlayerLabel()));
            return t("damenature.game.selection.no.card.message");
        }
        selectedCardIndex = Math.floorMod(selectedCardIndex + delta, cardOptions.size());
        CardOption option = cardOptions.get(selectedCardIndex);
        updateSelectionLabel();
        return t("damenature.game.selection.card.selected", option.label());
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

    JTextArea historyComponent() {
        return historySidebar.historyComponent();
    }

    String currentSelectionAnnouncement() {
        String description = t("damenature.game.selection.template", currentPlayerLabel(), currentCardLabel());
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
        setAccessibleName(turnLabel, t("damenature.game.turn.accessible"));
        selectionLabel.setAlignmentX(LEFT_ALIGNMENT);
        setAccessibleName(selectionLabel, t("damenature.game.selection.accessible"));
        setAccessibleDescription(selectionLabel, t("damenature.game.selection.desc"));
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
        infoPanel.add(section(t("damenature.game.section.commands"), wrap(instructionsArea, 320, 140)));
        infoPanel.add(Box.createRigidArea(new Dimension(0, 12)));
        infoPanel.add(section(t("damenature.game.section.hand"), wrap(handArea, 320, 160)));
        infoPanel.add(Box.createRigidArea(new Dimension(0, 12)));
        infoPanel.add(section(t("damenature.game.section.books"), wrap(booksArea, 320, 120)));
        infoPanel.add(Box.createRigidArea(new Dimension(0, 12)));
        infoPanel.add(section(t("damenature.game.section.opponents"), wrap(opponentsArea, 320, 140)));
        infoPanel.add(Box.createRigidArea(new Dimension(0, 12)));
        infoPanel.add(section(t("damenature.game.section.quiz"), wrap(quizArea, 320, 140)));

        center.add(infoPanel);
        center.add(Box.createRigidArea(new Dimension(16, 0)));

        center.add(historySidebar);

        add(center, BorderLayout.CENTER);

        statusLabel.setBorder(new EmptyBorder(8, 0, 0, 0));
        setAccessibleName(statusLabel, t("damenature.game.status.accessible"));
        add(statusLabel, BorderLayout.SOUTH);
    }

    private void initialiseInstructions() {
        instructionsArea.setLineWrap(true);
        instructionsArea.setWrapStyleWord(true);
        instructionsArea.setBorder(new EmptyBorder(4, 6, 4, 6));
        String instructionsText = t("damenature.game.instructions.text");
        instructionsArea.setText(instructionsText);
        setAccessibleDescription(instructionsArea, t("damenature.game.instructions.desc"));
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
            turnLabel.setText(t("damenature.game.turn.player", formatPlayerName(current)));
        } else {
            turnLabel.setText(t("damenature.game.turn.default"));
        }
    }

    private void updatePlayers(DameNatureState state, DameNatureState.Player self) {
        if (self != null) {
            StringBuilder handBuilder = new StringBuilder();
            self.hand().forEach(card -> handBuilder.append("• ").append(card).append('\n'));
            handArea.setText(handBuilder.isEmpty() ? t("damenature.game.hand.empty") : handBuilder.toString());
            setAccessibleDescription(handArea, handArea.getText());

            if (!self.books().isEmpty()) {
                StringBuilder booksBuilder = new StringBuilder();
                state.catalog().families().stream()
                        .filter(family -> self.books().contains(family.id()))
                        .sorted(Comparator.comparing(DameNatureState.Family::name))
                        .forEach(family -> booksBuilder.append("• ").append(family.name()).append('\n'));
                booksArea.setText(booksBuilder.toString());
            } else {
                booksArea.setText(t("damenature.game.books.empty"));
            }
            setAccessibleDescription(booksArea, booksArea.getText());
        } else {
            handArea.setText(t("damenature.game.hand.locked"));
            booksArea.setText(t("damenature.game.books.unknown"));
            setAccessibleDescription(handArea, handArea.getText());
            setAccessibleDescription(booksArea, booksArea.getText());
        }

        StringBuilder opponentsBuilder = new StringBuilder();
        state.players().forEach(player -> {
            opponentsBuilder.append("• ")
                    .append(t("damenature.game.opponents.entry",
                            formatPlayerName(player),
                            player.handCount(),
                            player.books().size()));
            if (state.turnIndex() == state.players().indexOf(player)) {
                opponentsBuilder.append(t("damenature.game.opponents.current"));
            }
            opponentsBuilder.append('\n');
        });
        opponentsArea.setText(opponentsBuilder.isEmpty() ? t("damenature.game.opponents.empty") : opponentsBuilder.toString());
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
                builder.append(t("damenature.game.quiz.choice", i + 1, currentQuizChoices.get(i))).append('\n');
            }
            quizArea.setText(builder.toString());
        } else {
            currentQuizChoices = List.of();
            quizArea.setText(t("damenature.game.quiz.none"));
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
        historySidebar.render(historyTracker, t("damenature.game.history.empty"));
        historyComponent().setCaretPosition(historyComponent().getDocument().getLength());
    }

    private void updateSelectionLabel() {
        String description = t("damenature.game.selection.template", currentPlayerLabel(), currentCardLabel());
        setSelectionDescription(description);
        accessibilityService.announceCustom(selectionLabel, description);
    }

    private String currentPlayerLabel() {
        if (selectedPlayerIndex < 0 || selectedPlayerIndex >= playerOptions.size()) {
            return t("damenature.game.selection.no.player.label");
        }
        return playerOptions.get(selectedPlayerIndex).label();
    }

    private String currentCardLabel() {
        if (selectedCardIndex < 0 || selectedCardIndex >= cardOptions.size()) {
            return t("damenature.game.selection.no.card.label");
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
            return isBot ? t("damenature.bot.only") : "";
        }
        return isBot ? base + t("damenature.bot.suffix") : base;
    }

    private void setSelectionDescription(String description) {
        selectionLabel.setText(description);
        setAccessibleDescription(selectionLabel, description);
    }

    private static JTextArea createReadOnlyArea(int rows, String accessibleNameKey) {
        JTextArea area = new JTextArea(rows, 32);
        area.setEditable(false);
        area.setLineWrap(true);
        area.setWrapStyleWord(true);
        area.setBorder(BorderFactory.createEmptyBorder(4, 6, 4, 6));
        area.getAccessibleContext().setAccessibleName(t(accessibleNameKey));
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

    private static String t(String key, Object... args) {
        return Internationalization.text(key, args);
    }

    static record PlayerOption(int id, String name, int handCount, boolean bot) {
        String label() {
            return t("damenature.game.player.label", displayName(), handCount);
        }

        String displayName() {
            return decorateBot(name, bot);
        }
    }

    static record CardOption(String familyId, String familyName, String memberId, String memberName) {
        String label() {
            return familyName + " - " + memberName;
        }
    }
}
