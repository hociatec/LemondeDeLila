package com.lemondelila.client.gamelogic.damenature.view;

import com.lemondelila.client.gamelogic.damenature.controller.DameNatureController;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureConfig;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureSession;
import com.lemondelila.client.gamelogic.damenature.model.DameNatureState;
import com.lemondelila.framework.ui.screen.Screen;
import com.lemondelila.framework.ui.screen.ScreenContext;
import com.lemondelila.framework.ui.screen.ScreenManager;

import javax.accessibility.AccessibleContext;
import javax.swing.AbstractAction;
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
import java.awt.CardLayout;
import java.awt.Dimension;
import java.awt.KeyboardFocusManager;
import java.awt.event.ActionEvent;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public final class DameNatureScreen extends JPanel implements Screen {

    private enum Mode {
        CONFIGURATION,
        GAMEPLAY
    }

    private final DameNatureController controller;
    private ScreenManager screenManager;

    private Mode mode = Mode.CONFIGURATION;
    private DameNatureConfig pendingConfig = DameNatureConfig.defaultConfig();
    private DameNatureConfig activeConfig = DameNatureConfig.defaultConfig();

    private final CardLayout viewLayout = new CardLayout();
    private final JPanel viewContainer = new JPanel(viewLayout);

    // Configuration
    private final JPanel configPanel = new JPanel();
    private final JLabel configStatusLabel = new JLabel(" ");
    private final JLabel botsValueLabel = new JLabel();
    private final JLabel dangerValueLabel = new JLabel();
    private final JLabel quizValueLabel = new JLabel();
    private final List<JComponent> configFocusOrder = new ArrayList<>();
    private int configFocusIndex;

    // Gameplay
    private final JPanel gamePanel = new JPanel(new BorderLayout(16, 16));
    private final JLabel turnLabel = new JLabel("Tour : -");
    private final JLabel selectionLabel = new JLabel("Sélection : aucune");
    private final JLabel statusLabel = new JLabel(" ");
    private final JTextArea instructionsArea = new JTextArea();
    private final JTextArea handArea = createReadOnlyArea(8, "Votre main");
    private final JTextArea booksArea = createReadOnlyArea(4, "Familles complétées");
    private final JTextArea opponentsArea = createReadOnlyArea(6, "Adversaires");
    private final JTextArea quizArea = createReadOnlyArea(4, "Quiz en cours");
    private final JTextArea logArea = createReadOnlyArea(10, "Historique");

    private DameNatureSession currentSession;
    private List<PlayerOption> playerOptions = List.of();
    private List<CardOption> cardOptions = List.of();
    private List<String> currentQuizChoices = List.of();
    private int selectedPlayerIndex = -1;
    private int selectedCardIndex = -1;
    private volatile boolean launchInProgress;

    private final Consumer<DameNatureSession> sessionListener = this::displaySession;

    public DameNatureScreen(DameNatureController controller) {
        this.controller = Objects.requireNonNull(controller, "controller");
        buildUi();
        installGlobalKeyBindings();
    }

    private void buildUi() {
        setLayout(new BorderLayout());
        setBorder(BorderFactory.createEmptyBorder(24, 32, 24, 32));
        setFocusable(true);
        setFocusTraversalKeysEnabled(false);
        addFocusListener(new FocusAdapter() {
            @Override
            public void focusGained(FocusEvent e) {
                // Nothing to do, but keep reference for screen readers.
            }
        });

        add(viewContainer, BorderLayout.CENTER);
        buildConfigPanel();
        buildGamePanel();
        showConfiguration();
    }

    private void buildConfigPanel() {
        configPanel.setOpaque(false);
        configFocusOrder.clear();
        configPanel.setLayout(new BoxLayout(configPanel, BoxLayout.Y_AXIS));
        configPanel.setBorder(new EmptyBorder(16, 16, 16, 16));

        JLabel title = new JLabel("Préparer la partie Dame Nature");
        title.setFont(title.getFont().deriveFont(24f));
        title.setAlignmentX(LEFT_ALIGNMENT);
        configPanel.add(title);
        configPanel.add(Box.createRigidArea(new Dimension(0, 16)));

        JLabel instructions = new JLabel("Utilisez ↑/↓ pour naviguer, ←/→ pour ajuster les options, Entrée pour lancer.");
        instructions.setAlignmentX(LEFT_ALIGNMENT);
        configPanel.add(instructions);
        configPanel.add(Box.createRigidArea(new Dimension(0, 12)));

        configPanel.add(optionRow("Nombre d'adversaires", botsValueLabel));
        configPanel.add(Box.createRigidArea(new Dimension(0, 6)));
        configPanel.add(optionRow("Cartes danger", dangerValueLabel));
        configPanel.add(Box.createRigidArea(new Dimension(0, 6)));
        configPanel.add(optionRow("Quiz nature", quizValueLabel));
        configPanel.add(Box.createRigidArea(new Dimension(0, 12)));

        JLabel launchHint = new JLabel("Appuyez sur Entrée pour lancer la partie, Échap pour annuler.");
        launchHint.setAlignmentX(LEFT_ALIGNMENT);
        configPanel.add(launchHint);
        configPanel.add(Box.createRigidArea(new Dimension(0, 16)));

        configStatusLabel.setAlignmentX(LEFT_ALIGNMENT);
        configStatusLabel.getAccessibleContext().setAccessibleName("Statut configuration");
        updateAccessible(configStatusLabel, "");
        configPanel.add(configStatusLabel);

        viewContainer.add(configPanel, Mode.CONFIGURATION.name());
        setupConfigNavigation();
        updateConfigLabels();
    }

    private JPanel optionRow(String label, JLabel valueLabel) {
        JPanel row = new JPanel(new BorderLayout(8, 0));
        row.setOpaque(false);
        row.setBorder(new EmptyBorder(6, 8, 6, 8));
        JLabel jLabel = new JLabel(label);
        row.add(jLabel, BorderLayout.WEST);
        row.add(valueLabel, BorderLayout.CENTER);
        valueLabel.setHorizontalAlignment(JLabel.RIGHT);
        row.setFocusable(true);
        row.setFocusTraversalKeysEnabled(false);
        row.addFocusListener(new FocusAdapter() {
            @Override
            public void focusGained(FocusEvent e) {
                row.setBorder(BorderFactory.createLineBorder(new java.awt.Color(70, 130, 180), 2));
                configFocusIndex = configFocusOrder.indexOf(row);
            }

            @Override
            public void focusLost(FocusEvent e) {
                row.setBorder(new EmptyBorder(6, 8, 6, 8));
            }
        });
        configFocusOrder.add(row);
        return row;
    }

    private void setupConfigNavigation() {
        configPanel.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("UP"), "config-up");
        configPanel.getActionMap().put("config-up", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                moveConfigFocus(-1);
            }
        });

        configPanel.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("DOWN"), "config-down");
        configPanel.getActionMap().put("config-down", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                moveConfigFocus(1);
            }
        });

        configPanel.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("LEFT"), "config-left");
        configPanel.getActionMap().put("config-left", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                adjustConfigValue(-1);
            }
        });

        configPanel.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("RIGHT"), "config-right");
        configPanel.getActionMap().put("config-right", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                adjustConfigValue(1);
            }
        });

        configPanel.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("ENTER"), "config-launch");
        configPanel.getActionMap().put("config-launch", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                startConfiguredGame();
            }
        });

        configPanel.getInputMap(WHEN_ANCESTOR_OF_FOCUSED_COMPONENT).put(KeyStroke.getKeyStroke("ESCAPE"), "config-cancel");
        configPanel.getActionMap().put("config-cancel", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                // Revenir à l'écran précédent
                if (screenManager != null) {
                    screenManager.show("home");
                }
            }
        });
    }

    private void moveConfigFocus(int delta) {
        if (configFocusOrder.isEmpty()) {
            return;
        }
        configFocusIndex = Math.floorMod(configFocusIndex + delta, configFocusOrder.size());
        SwingUtilities.invokeLater(() -> configFocusOrder.get(configFocusIndex).requestFocusInWindow());
    }

    private void adjustConfigValue(int delta) {
        if (configFocusIndex < 0 || configFocusIndex >= configFocusOrder.size()) {
            return;
        }
        if (configFocusIndex == 0) {
            updatePendingConfig(pendingConfig.withBotCount(pendingConfig.botCount() + delta));
        } else if (configFocusIndex == 1) {
            updatePendingConfig(pendingConfig.withIncludeDanger(delta > 0 || !pendingConfig.includeDangerCards()));
        } else if (configFocusIndex == 2) {
            updatePendingConfig(pendingConfig.withIncludeQuiz(delta > 0 || !pendingConfig.includeQuizCards()));
        }
    }

    private void updatePendingConfig(DameNatureConfig config) {
        pendingConfig = config;
        updateConfigLabels();
    }

    private void updateConfigLabels() {
        botsValueLabel.setText(pendingConfig.botCount() + " bot(s)");
        dangerValueLabel.setText(pendingConfig.includeDangerCards() ? "Activées" : "Désactivées");
        quizValueLabel.setText(pendingConfig.includeQuizCards() ? "Activés" : "Désactivés");
    }

    private void buildGamePanel() {
        gamePanel.setOpaque(false);
        JPanel header = new JPanel();
        header.setOpaque(false);
        header.setLayout(new BoxLayout(header, BoxLayout.Y_AXIS));
        turnLabel.setFont(turnLabel.getFont().deriveFont(20f));
        turnLabel.setAlignmentX(LEFT_ALIGNMENT);
        selectionLabel.getAccessibleContext().setAccessibleName("Sélection courante");
        selectionLabel.setAlignmentX(LEFT_ALIGNMENT);
        selectionLabel.getAccessibleContext().setAccessibleName("Sélection courante");
        updateAccessible(selectionLabel, "Sélection : aucune");
        header.add(turnLabel);
        header.add(Box.createRigidArea(new Dimension(0, 6)));
        header.add(selectionLabel);
        header.add(Box.createRigidArea(new Dimension(0, 12)));
        gamePanel.add(header, BorderLayout.NORTH);

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

        JScrollPane logScroll = new JScrollPane(logArea);
        logScroll.setBorder(BorderFactory.createTitledBorder("Historique"));
        logScroll.setPreferredSize(new Dimension(420, 380));
        center.add(logScroll);

        gamePanel.add(center, BorderLayout.CENTER);

        statusLabel.setBorder(new EmptyBorder(8, 0, 0, 0));
        statusLabel.getAccessibleContext().setAccessibleName("Statut de la partie");
        statusLabel.setText("Prêt.");
        updateAccessible(statusLabel, "Prêt.");
        JPanel statusPanel = new JPanel(new BorderLayout());
        statusPanel.setOpaque(false);
        statusPanel.add(statusLabel, BorderLayout.CENTER);
        gamePanel.add(statusPanel, BorderLayout.SOUTH);

        initialiseInstructions();
        configureLogNavigation(logScroll);
        viewContainer.add(gamePanel, Mode.GAMEPLAY.name());
    }

    private void initialiseInstructions() {
        instructionsArea.setEditable(false);
        instructionsArea.setLineWrap(true);
        instructionsArea.setWrapStyleWord(true);
        instructionsArea.setBorder(new EmptyBorder(4, 6, 4, 6));
        instructionsArea.getAccessibleContext().setAccessibleName("Commandes disponibles");
        updateAccessible(instructionsArea, "Liste des raccourcis clavier du jeu Dame Nature");
        instructionsArea.setText("""
                Espace : piocher.
                Flèches haut / bas : changer d'adversaire.
                Flèches gauche / droite : changer la carte à demander.
                E : demander la carte sélectionnée.
                R : actualiser la partie.
                T : annoncer le tour en cours.
                C : ouvrir la configuration et relancer la partie.
                1-9 : répondre à un quiz.
                Tab : aller à l'historique, Maj+Tab pour revenir.
                Échap : revenir à la configuration depuis le jeu.
                """);
        instructionsArea.setCaretPosition(0);
        updateAccessible(instructionsArea, instructionsArea.getText());
    }

    private void configureLogNavigation(JScrollPane logScroll) {
        disableTabTraversal(logArea);
        logArea.getInputMap(WHEN_FOCUSED).put(KeyStroke.getKeyStroke("shift TAB"), "log-exit");
        logArea.getActionMap().put("log-exit", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (mode != Mode.GAMEPLAY) {
                    return;
                }
                announce("Retour sur la zone de jeu.");
                SwingUtilities.invokeLater(() -> DameNatureScreen.this.requestFocusInWindow());
            }
        });

        getInputMap(WHEN_IN_FOCUSED_WINDOW).put(KeyStroke.getKeyStroke("TAB"), "focus-log");
        getActionMap().put("focus-log", new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (mode != Mode.GAMEPLAY) {
                    return;
                }
                SwingUtilities.invokeLater(() -> {
                    logArea.requestFocusInWindow();
                    logArea.setCaretPosition(logArea.getDocument().getLength());
                });
            }
        });
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

    private void installGlobalKeyBindings() {
        registerShortcut("SPACE", "damenature-draw", e -> triggerDraw());
        registerShortcut('T', "damenature-turn", e -> announceCurrentTurn());
        registerShortcut('t', "damenature-turn", e -> announceCurrentTurn());
        registerShortcut("UP", "damenature-target-prev", e -> cycleTarget(-1));
        registerShortcut("DOWN", "damenature-target-next", e -> cycleTarget(1));
        registerShortcut("LEFT", "damenature-card-prev", e -> cycleCard(-1));
        registerShortcut("RIGHT", "damenature-card-next", e -> cycleCard(1));
        registerShortcut('E', "damenature-request", e -> sendAskAction());
        registerShortcut('e', "damenature-request", e -> sendAskAction());
        registerShortcut('R', "damenature-refresh", e -> handleActionFeedback(controller.refresh(), "Actualisation en cours...", null, null));
        registerShortcut('r', "damenature-refresh", e -> handleActionFeedback(controller.refresh(), "Actualisation en cours...", null, null));
        registerShortcut('C', "damenature-open-config", e -> {
            if (mode == Mode.GAMEPLAY) {
                announce("Configuration ouverte. Modifiez les options puis Entrée pour relancer.");
                openConfiguration();
            }
        });
        registerShortcut('c', "damenature-open-config", e -> {
            if (mode == Mode.GAMEPLAY) {
                announce("Configuration ouverte. Modifiez les options puis Entrée pour relancer.");
                openConfiguration();
            }
        });
        registerShortcut("ESCAPE", "damenature-config", e -> {
            if (mode == Mode.GAMEPLAY) {
                announce("Retour à la configuration.");
                openConfiguration();
            }
        });

        for (int i = 0; i < 9; i++) {
            char digit = (char) ('1' + i);
            final int index = i;
            registerShortcut(digit, "quiz-answer-" + digit, e -> answerQuiz(index));
        }
    }

    private void registerShortcut(char key, String actionId, java.util.function.Consumer<ActionEvent> handler) {
        registerShortcut(KeyStroke.getKeyStroke(key), actionId, handler);
    }

    private void registerShortcut(String keyStroke, String actionId, java.util.function.Consumer<ActionEvent> handler) {
        registerShortcut(KeyStroke.getKeyStroke(keyStroke), actionId, handler);
    }

    private void registerShortcut(KeyStroke stroke, String actionId, java.util.function.Consumer<ActionEvent> handler) {
        getInputMap(WHEN_IN_FOCUSED_WINDOW).put(stroke, actionId);
        getActionMap().put(actionId, new AbstractAction() {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (mode == Mode.GAMEPLAY) {
                    handler.accept(e);
                }
            }
        });
    }

    private void showConfiguration() {
        mode = Mode.CONFIGURATION;
        viewLayout.show(viewContainer, Mode.CONFIGURATION.name());
        if (!configFocusOrder.isEmpty()) {
            configFocusIndex = 0;
            SwingUtilities.invokeLater(() -> configFocusOrder.get(0).requestFocusInWindow());
        }
    }

    private void openConfiguration() {
        controller.reset();
        pendingConfig = activeConfig;
        updateConfigLabels();
        configStatusLabel.setText("Ajustez les options puis appuyez sur Entrée pour relancer.");
        updateAccessible(configStatusLabel, configStatusLabel.getText());
        currentSession = null;
        playerOptions = List.of();
        cardOptions = List.of();
        selectedPlayerIndex = -1;
        selectedCardIndex = -1;
        launchInProgress = false;
        showConfiguration();
        announceSelection();
    }

    private void showGameplay() {
        mode = Mode.GAMEPLAY;
        viewLayout.show(viewContainer, Mode.GAMEPLAY.name());
        SwingUtilities.invokeLater(() -> DameNatureScreen.this.requestFocusInWindow());
    }

    private void startConfiguredGame() {
        configStatusLabel.setText("Initialisation de la partie...");
        launchInProgress = true;
        CompletableFuture<DameNatureSession> future = controller.startNewGame(pendingConfig);
        handleActionFeedback(future, "Initialisation de la partie...", () -> {
            activeConfig = pendingConfig;
            configStatusLabel.setText("Partie lancée.");
            updateAccessible(configStatusLabel, configStatusLabel.getText());
            launchInProgress = false;
            showGameplay();
        }, throwable -> {
            launchInProgress = false;
            configStatusLabel.setText("Impossible de lancer la partie : " +
                    (throwable.getMessage() == null ? "erreur inconnue" : throwable.getMessage()));
            updateAccessible(configStatusLabel, configStatusLabel.getText());
        });
    }

    private void displaySession(DameNatureSession session) {
        if (mode != Mode.GAMEPLAY) {
            if (launchInProgress) {
                showGameplay();
            } else {
                return;
            }
        }
        launchInProgress = false;
        this.currentSession = session;
        DameNatureState state = session.state();
        updateTurnIndicators(state);
        updatePlayers(state, session.self());
        updateCardSelections(state, session.self());
        updateQuiz(state);
        updateLog(state);
        announce(extractLastLogMessage(session));
    }

    private void updateTurnIndicators(DameNatureState state) {
        List<DameNatureState.Player> players = state.players();
        if (!players.isEmpty() && state.turnIndex() >= 0 && state.turnIndex() < players.size()) {
            turnLabel.setText("Tour : " + players.get(state.turnIndex()).username());
        } else {
            turnLabel.setText("Tour : -");
        }
        announceSelection();
    }

    private void updatePlayers(DameNatureState state, DameNatureState.Player self) {
        if (self != null) {
            StringBuilder handBuilder = new StringBuilder();
            self.hand().forEach(card -> handBuilder.append("• ").append(card.toString()).append('\n'));
            handArea.setText(handBuilder.isEmpty() ? "Aucune carte en main." : handBuilder.toString());
            updateAccessible(handArea, handArea.getText());

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
            updateAccessible(booksArea, booksArea.getText());
        } else {
            handArea.setText("Rejoignez la partie pour consulter votre main.");
            booksArea.setText("Aucune information disponible.");
            updateAccessible(handArea, handArea.getText());
            updateAccessible(booksArea, booksArea.getText());
        }

        StringBuilder opponentsBuilder = new StringBuilder();
        state.players().forEach(player -> {
            opponentsBuilder.append("• ")
                    .append(player.username())
                    .append(" - cartes : ").append(player.handCount())
                    .append(" - familles : ").append(player.books().size());
            if (state.turnIndex() == state.players().indexOf(player)) {
                opponentsBuilder.append(" (au tour)");
            }
            opponentsBuilder.append('\n');
        });
        opponentsArea.setText(opponentsBuilder.isEmpty() ? "Aucun adversaire." : opponentsBuilder.toString());
        updateAccessible(opponentsArea, opponentsArea.getText());
    }

    private void updateCardSelections(DameNatureState state, DameNatureState.Player self) {
        if (self == null) {
            playerOptions = List.of();
            cardOptions = List.of();
            selectedPlayerIndex = -1;
            selectedCardIndex = -1;
            announceSelection();
            return;
        }

        playerOptions = state.players().stream()
                .filter(player -> player.id() != self.id())
                .map(player -> new PlayerOption(player.id(), player.username(), player.handCount()))
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
        announceSelection();
    }

    private void announceSelection() {
        String adversaire = selectedPlayerIndex >= 0 && selectedPlayerIndex < playerOptions.size()
                ? playerOptions.get(selectedPlayerIndex).label()
                : "aucun adversaire";
        String carte = selectedCardIndex >= 0 && selectedCardIndex < cardOptions.size()
                ? cardOptions.get(selectedCardIndex).label()
                : "aucune carte";
        String text = "Sélection : adversaire " + adversaire + " | carte " + carte;
        selectionLabel.setText(text);
        updateAccessible(selectionLabel, text);
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
        updateAccessible(quizArea, quizArea.getText());
    }

    private void updateLog(DameNatureState state) {
        StringBuilder builder = new StringBuilder();
        state.log().stream()
                .skip(Math.max(0, state.log().size() - 20))
                .forEach(entry -> builder.append("• ").append(entry.message()).append('\n'));
        logArea.setText(builder.toString());
        logArea.setCaretPosition(logArea.getDocument().getLength());
        updateAccessible(logArea, logArea.getText());
    }

    private void cycleTarget(int delta) {
        if (playerOptions.isEmpty()) {
            selectedPlayerIndex = -1;
            announce("Aucun adversaire disponible.");
            announceSelection();
            return;
        }
        selectedPlayerIndex = Math.floorMod(selectedPlayerIndex + delta, playerOptions.size());
        PlayerOption option = playerOptions.get(selectedPlayerIndex);
        announce("Adversaire sélectionné : " + option.label());
        announceSelection();
    }

    private void cycleCard(int delta) {
        if (cardOptions.isEmpty()) {
            selectedCardIndex = -1;
            announce("Aucune carte disponible à demander.");
            announceSelection();
            return;
        }
        selectedCardIndex = Math.floorMod(selectedCardIndex + delta, cardOptions.size());
        CardOption option = cardOptions.get(selectedCardIndex);
        announce("Carte sélectionnée : " + option.label());
        announceSelection();
    }

    private void sendAskAction() {
        if (selectedPlayerIndex < 0 || selectedPlayerIndex >= playerOptions.size()) {
            announce("Choisissez un adversaire avec les flèches haut ou bas.");
            return;
        }
        if (selectedCardIndex < 0 || selectedCardIndex >= cardOptions.size()) {
            announce("Choisissez une carte avec les flèches gauche ou droite.");
            return;
        }
        PlayerOption target = playerOptions.get(selectedPlayerIndex);
        CardOption card = cardOptions.get(selectedCardIndex);
        handleActionFeedback(
                controller.askCard(target.id(), card.familyId(), card.memberId()),
                "Demande de " + card.memberName() + " à " + target.name() + "...",
                null,
                null
        );
    }

    private void triggerDraw() {
        handleActionFeedback(controller.draw(), "Pioche en cours...", null, null);
    }

    private void answerQuiz(int index) {
        if (currentQuizChoices.isEmpty()) {
            announce("Aucun quiz à répondre.");
            return;
        }
        if (index < 0 || index >= currentQuizChoices.size()) {
            announce("Choix invalide.");
            return;
        }
        handleActionFeedback(
                controller.answerQuiz(index),
                "Réponse " + (index + 1) + " envoyée.",
                null,
                null
        );
    }

    private void announceCurrentTurn() {
        if (currentSession == null) {
            announce("Aucune partie active.");
            return;
        }
        DameNatureState state = currentSession.state();
        List<DameNatureState.Player> players = state.players();
        if (players.isEmpty() || state.turnIndex() < 0 || state.turnIndex() >= players.size()) {
            announce("Tour inconnu.");
            return;
        }
        DameNatureState.Player player = players.get(state.turnIndex());
        announce("C'est au tour de " + player.username() + ".");
    }

    private void handleActionFeedback(CompletableFuture<DameNatureSession> future, String pendingMessage,
                                      Runnable onSuccess,
                                      java.util.function.Consumer<Throwable> onError) {
        if (pendingMessage != null && !pendingMessage.isBlank()) {
            announce(pendingMessage);
        }
        future.whenComplete((session, error) -> SwingUtilities.invokeLater(() -> {
            if (error != null) {
                Throwable cause = error.getCause() != null ? error.getCause() : error;
                String message = cause.getMessage();
                announce(message == null || message.isBlank()
                        ? "Action impossible."
                        : message);
                if (onError != null) {
                    onError.accept(cause);
                }
            } else if (session != null) {
                if (onSuccess != null) {
                    onSuccess.run();
                }
            }
            // displaySession (listener) provides detailed feedback on success
        }));
    }

    private void handleActionFeedback(CompletableFuture<DameNatureSession> future, String pendingMessage) {
        handleActionFeedback(future, pendingMessage, null, null);
    }

    private String extractLastLogMessage(DameNatureSession session) {
        List<DameNatureState.LogEntry> logs = session.state().log();
        if (logs != null && !logs.isEmpty()) {
            return logs.get(logs.size() - 1).message();
        }
        return "Action effectuée.";
    }

    private void announce(String message) {
        statusLabel.setText(message);
        updateAccessible(statusLabel, message);
    }

    private void updateAccessible(JComponent component, String description) {
        if (component == null) {
            return;
        }
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

    @Override
    public String id() {
        return "dame-nature";
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        controller.addListener(sessionListener);
        pendingConfig = activeConfig;
        updateConfigLabels();
        Optional<DameNatureSession> current = controller.currentSession();
        if (current.isPresent()) {
            activeConfig = pendingConfig;
            showGameplay();
            displaySession(current.get());
        } else {
            pendingConfig = activeConfig;
            showGameplay();
            logArea.setText("Lancement de la partie...");
            updateAccessible(logArea, logArea.getText());
            launchInProgress = true;
            handleActionFeedback(
                    controller.startNewGame(activeConfig),
                    "Lancement de la partie...",
                    () -> launchInProgress = false,
                    throwable -> launchInProgress = false
            );
        }
    }

    @Override
    public void onHide(ScreenContext context) {
        controller.removeListener(sessionListener);
    }

    private static void disableTabTraversal(JComponent component) {
        component.setFocusTraversalKeys(KeyboardFocusManager.FORWARD_TRAVERSAL_KEYS, Collections.emptySet());
        component.setFocusTraversalKeys(KeyboardFocusManager.BACKWARD_TRAVERSAL_KEYS, Collections.emptySet());
    }

    private record PlayerOption(int id, String name, int handCount) {
        String label() {
            return name + " (" + handCount + " cartes)";
        }
    }

    private record CardOption(String familyId, String familyName, String memberId, String memberName) {
        String label() {
            return familyName + " - " + memberName;
        }
    }
}
