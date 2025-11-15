package com.lemondelila.client.gamelogic.missionnemesis.view;

import com.lemondelila.client.game.controller.GameInteractionController;
import com.lemondelila.client.gamelogic.missionnemesis.controller.NemesisController;
import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSpecs;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;
import com.lemondelila.client.catalogue.model.GameSummary;
import com.lemondelila.client.catalogue.view.CatalogScreen;
import com.lemondelila.client.catalogue.service.GameRulesService;
import com.lemondelila.client.framework.access.game.AccessibilityService;
import com.lemondelila.client.framework.access.game.GameHistorySidebar;
import com.lemondelila.client.framework.access.game.GameHistoryTracker;
import com.lemondelila.client.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.client.framework.access.shortcut.ShortcutBinder;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.ui.dialog.DialogService;
import com.lemondelila.client.framework.ui.screen.Screen;
import com.lemondelila.client.framework.ui.screen.ScreenContext;
import com.lemondelila.client.framework.ui.screen.ScreenId;
import com.lemondelila.client.framework.ui.screen.ScreenManager;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.JPanel;
import javax.swing.JTextArea;
import javax.swing.KeyStroke;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.GridLayout;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import java.util.stream.Collectors;

public final class NemesisScreen extends JPanel implements Screen {

    public static final ScreenId ID = ScreenId.of("mission-nemesis");

    private enum ViewState {
        SETUP,
        MANUAL_PLACEMENT,
        ACTIVE_GAME
    }

    private static final GameSummary GAME_SUMMARY = new GameSummary(
            "mission-nemesis",
            "Mission Nemesis",
            1,
            2,
            "missionnemesis",
            "Affrontez un adversaire dans une bataille spatiale tactique.",
            true,
            List.of("jeux-de-plateau")
    );

    private final NemesisController controller;
    private final AccessibilityService accessibilityService;
    private final AccessibleShortcutRegistry shortcutRegistry;
    private final DialogService dialogService;
    private final GameInteractionController interactionController;
    private final ShortcutBinder shortcutBinder;

    private ScreenManager screenManager;
    private NemesisSession currentSession;
    private ViewState state = ViewState.SETUP;

    private final NemesisSetupPanel setupPanel;
    private final NemesisPlacementPanel placementPanel = new NemesisPlacementPanel();
    private final GameHistorySidebar historySidebar = new GameHistorySidebar(
            "Journal des actions",
            "Historique des actions",
            "Derniers évènements de la partie Mission Nemesis."
    );
    private final GameHistoryTracker historyTracker = new GameHistoryTracker();
    private final NemesisFooterPanel footerPanel;
    private final NemesisGridPanel ownGrid;
    private final NemesisGridPanel enemyGrid;
    private final CardLayout mainLayout = new CardLayout();
    private final JPanel mainPanel = new JPanel(mainLayout);

    private NemesisPlacementOrchestrator placementOrchestrator;

    private final Consumer<NemesisSession> sessionListener = this::displaySession;

    @Inject
    public NemesisScreen(NemesisController controller,
                         NemesisSessionStore sessionStore,
                         AccessibilityService accessibilityService,
                         AccessibleShortcutRegistry shortcutRegistry,
                         DialogService dialogService,
                         GameRulesService rulesService) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.accessibilityService = Objects.requireNonNull(accessibilityService, "accessibilityService");
        this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
        this.dialogService = Objects.requireNonNull(dialogService, "dialogService");
        Objects.requireNonNull(sessionStore, "sessionStore");
        this.ownGrid = new NemesisGridPanel(true, coordinate -> {});
        this.enemyGrid = new NemesisGridPanel(false, this::fireAt);
        this.setupPanel = new NemesisSetupPanel(this::handleStartRequested);
        this.footerPanel = new NemesisFooterPanel(accessibilityService);
        historyTracker.setMaxEntries(400);
        this.interactionController = new GameInteractionController(
                this,
                dialogService,
                Objects.requireNonNull(rulesService, "rulesService"),
                () -> Optional.of(GAME_SUMMARY),
                this::exitToCatalog,
                this::setStatus,
                this::addBotCommand,
                this::removeBotCommand,
                this::announceTableParticipants,
                this::announceCurrentTurn
        );
        interactionController.setEnabled(false);
        this.shortcutBinder = new ShortcutBinder(shortcutRegistry, () -> true, this);

        enemyGrid.setFireSelectionListener(this::updateSelectionStatus);
        buildUi();
        configureKeyMap();
    }

    private void buildUi() {
        setLayout(new BorderLayout(16, 16));
        setBorder(BorderFactory.createEmptyBorder(24, 32, 24, 32));
        setFocusTraversalKeysEnabled(false);

        add(new NemesisHeaderPanel(), BorderLayout.NORTH);

        JPanel gridsContainer = new JPanel(new GridLayout(1, 2, 16, 16));
        gridsContainer.add(ownGrid);
        gridsContainer.add(enemyGrid);

        JPanel setupContainer = new JPanel(new BorderLayout());
        setupContainer.add(setupPanel, BorderLayout.CENTER);

        JPanel battleContainer = new JPanel(new BorderLayout(12, 12));
        battleContainer.add(placementPanel, BorderLayout.NORTH);
        battleContainer.add(gridsContainer, BorderLayout.CENTER);
        historySidebar.setPreferredSize(new java.awt.Dimension(0, 180));
        battleContainer.add(historySidebar, BorderLayout.SOUTH);

        mainPanel.add(setupContainer, ViewState.SETUP.name());
        mainPanel.add(battleContainer, ViewState.ACTIVE_GAME.name());

        add(mainPanel, BorderLayout.CENTER);
        add(footerPanel, BorderLayout.SOUTH);

        showSetup();
    }

    private void configureKeyMap() {
        shortcutRegistry.clear();
        shortcutBinder.registerStroke("ESCAPE", "nemesis-esc-disabled", "Echap : aucune action durant la partie.", e -> setStatus("Echap est desactive pendant la partie. Utilisez Q pour quitter."));

        shortcutBinder.registerStroke("F5", "nemesis-refresh", "F5 : rafraichir l'etat de la partie.", e -> {
            if (currentSession == null) {
                return;
            }
            setStatus("Rafraichissement de l'etat en cours...");
            controller.refresh().whenComplete((session, error) ->
                    SwingUtilities.invokeLater(() -> {
                        if (error != null) {
                            setStatus("Impossible de rafraichir l'etat de la partie.");
                        } else {
                            setStatus("Etat mis a jour.");
                        }
                    })
            );
        });
        shortcutBinder.registerLetterDescription('w', "Lettre W : annoncer les joueurs presents.");
        shortcutBinder.registerLetterDescription('t', "Lettre T : annoncer le tour en cours.");
        shortcutRegistry.applyTo(this);
    }

    private CompletableFuture<Void> addBotCommand() {
        return controller.addBot().thenApply(session -> null);
    }

    private CompletableFuture<Void> removeBotCommand() {
        return controller.removeBot().thenApply(session -> null);
    }

        getInputMap(WHEN_IN_FOCUSED_WINDOW).put(stroke, actionId);
        getActionMap().put(actionId, new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                handler.accept(e);
            }
        });
    private void handleStartRequested(NemesisSetupPanel.Configuration configuration) {
        setStatus("Création de la partie Mission Nemesis...");
        controller.startNewGame().whenComplete((session, error) ->
                SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        setStatus("Impossible de créer la partie Mission Nemesis.");
                        return;
                    }
                    currentSession = session;
                    state = configuration.placementMode() == NemesisSetupPanel.PlacementMode.MANUAL
                            ? ViewState.MANUAL_PLACEMENT
                            : ViewState.ACTIVE_GAME;
                    mainLayout.show(mainPanel, ViewState.ACTIVE_GAME.name());
                    placementPanel.clear();
                    historySidebar.clear();
                    displaySession(session);
                    if (state == ViewState.MANUAL_PLACEMENT) {
                        startManualPlacement();
                    } else {
                        startAutoPlacement();
                    }
                })
        );
    }

    private void startAutoPlacement() {
        state = ViewState.ACTIVE_GAME;
        placementPanel.showAutoPlacementMessage();
        setStatus("Placement automatique en cours...");
        List<ShipPlacement> placements = NemesisSpecs.defaultPlacements();
        controller.placeFleet(placements).whenComplete((session, error) ->
                SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        setStatus("Placement automatique indisponible, passage en mode manuel.");
                        state = ViewState.MANUAL_PLACEMENT;
                        startManualPlacement();
                    } else {
                        setStatus("Flotte placée automatiquement.");
                        state = ViewState.ACTIVE_GAME;
                        placementPanel.showCombatHelp();
                    }
                })
        );
    }

    private void startManualPlacement() {
        placementOrchestrator = new NemesisPlacementOrchestrator(
                ownGrid,
                placementPanel,
                placements -> controller.placeFleet(placements).whenComplete((session, error) ->
                        SwingUtilities.invokeLater(() -> {
                            if (error != null) {
                                setStatus("Impossible d’enregistrer le placement.");
                                showSetup();
                            } else {
                                setStatus("Placement transmis. Préparation du combat...");
                                state = ViewState.ACTIVE_GAME;
                                placementPanel.showCombatHelp();
                            }
                        })
                ),
                this::cancelManualPlacement,
                this::setStatus
        );
        placementOrchestrator.start();
        setStatus("Placement manuel : flèches pour naviguer, Entrée pour valider.");
    }

    private void cancelManualPlacement() {
        controller.reset();
        setStatus("Placement annulé. Retour à la configuration.");
        showSetup();
    }

    private void fireAt(GridCoordinate coordinate) {
        NemesisSession snapshot = currentSession;
        if (snapshot == null || !snapshot.isAwaitingCombatTurn()) {
            return;
        }
        setStatus("Tir en cours sur " + formatCoordinateHuman(coordinate) + "...");
        controller.fire(coordinate).whenComplete((result, error) ->
                SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        setStatus("Tir impossible.");
                    } else {
                        setStatus("Tir envoyé.");
                    }
                })
        );
    }

    private void displaySession(NemesisSession session) {
        this.currentSession = session;
        ownGrid.renderOwn(session, this::formatPlayerName);
        enemyGrid.renderEnemy(session, this::formatPlayerName);
        enemyGrid.setFiringEnabled(session.isAwaitingCombatTurn(), session);
        if (session.isAwaitingCombatTurn()) {
            enemyGrid.setFireSelectionListener(this::updateSelectionStatus);
        } else {
            enemyGrid.setFireSelectionListener(null);
        }

        updateLog(session);
        updateParticipantSummary(session);
        updateMetadata(session);
        if (state == ViewState.MANUAL_PLACEMENT && !session.isPlacementRequired()) {
            state = ViewState.ACTIVE_GAME;
            placementPanel.showCombatHelp();
        }
    }

    private void updateMetadata(NemesisSession session) {
        footerPanel.showRound(session.state().round());
        String phase = session.isPlacementRequired()
                ? "Placement"
                : session.finished() ? "Terminée" : "Combat";
        footerPanel.showPhase(phase);

        if (session.finished()) {
            session.score().ifPresentOrElse(score -> {
                if (score.winnerId() != null) {
                    String winner = findPlayerById(session.state(), score.winnerId())
                            .map(this::formatPlayerName)
                            .orElse("Joueur " + score.winnerId());
                    setStatus("Partie terminée. Vainqueur : " + winner + ".");
                } else {
                    setStatus("Partie terminée. Égalité.");
                }
            }, () -> setStatus("Partie terminée."));
        } else if (session.isPlacementRequired() && state != ViewState.MANUAL_PLACEMENT) {
            String pending = describePendingPlacement(session);
            setStatus(pending.isBlank() ? "Attente du placement adverse..." : pending);
        } else if (session.isAwaitingCombatTurn()) {
            String opponents = describeOpponents(session);
            if (opponents.isBlank()) {
                setStatus("Choisissez une case à l’aide des flèches puis validez avec Entrée.");
            } else {
                setStatus("À vous de jouer contre " + opponents + ". Choisissez une case à l’aide des flèches puis validez avec Entrée.");
            }
            placementPanel.showCombatHelp();
        } else {
            String waiting = describeCurrentTurnHolder(session);
            setStatus(waiting.isBlank() ? "Attente du tour adverse..." : waiting);
        }
    }

    private void updateLog(NemesisSession session) {
        Map<Integer, String> playerNames = new HashMap<>();
        session.state().players().forEach(player -> playerNames.put(player.id(), formatPlayerName(player)));
        List<String> lines = new ArrayList<>();
        session.state().log().forEach(entry -> {
            String line = formatLogEntry(entry, playerNames);
            if (!line.isBlank()) {
                lines.add(line);
            }
        });
        historyTracker.setEntries(lines);
        historySidebar.render(historyTracker, "Aucun évènement pour le moment.");
        JTextArea area = historySidebar.historyComponent();
        area.setCaretPosition(area.getDocument().getLength());
    }

    private String formatLogEntry(NemesisState.LogEntry entry, Map<Integer, String> playerNames) {
        String type = entry.type() != null ? entry.type() : "";
        return switch (type) {
            case "phase" -> "Phase : " + (entry.message() != null ? entry.message() : "");
            case "shot" -> {
                String shooter = resolvePlayerName(playerNames, entry.fromPlayerId());
                String target = resolvePlayerName(playerNames, entry.targetPlayerId());
                String result = entry.result() != null ? entry.result() : "inconnu";
                yield shooter + " tire sur " + target + " (" + entry.x() + "," + entry.y() + ") : " + result;
            }
            case "elimination" -> {
                String shooter = resolvePlayerName(playerNames, entry.fromPlayerId());
                String target = resolvePlayerName(playerNames, entry.targetPlayerId());
                yield shooter + " élimine " + target + ".";
            }
            default -> entry.message() != null ? entry.message() : "";
        };
    }

    private void updateSelectionStatus(GridCoordinate coordinate) {
        String base = "Cible : " + formatCoordinateHuman(coordinate) + ". Entrée pour tirer.";
        NemesisSession snapshot = currentSession;
        if (snapshot == null) {
            setStatus(base);
            return;
        }
        String opponents = describeOpponents(snapshot);
        if (opponents.isBlank()) {
            setStatus(base);
        } else {
            setStatus(base + " Adversaire(s) : " + opponents + ".");
        }
    }

    private String formatCoordinateHuman(GridCoordinate coordinate) {
        return "(" + (coordinate.x() + 1) + "," + (coordinate.y() + 1) + ")";
    }

    private void updateParticipantSummary(NemesisSession session) {
        List<NemesisState.Player> bots = session.state().players().stream()
                .filter(NemesisState.Player::isBot)
                .collect(Collectors.toList());
        if (bots.isEmpty()) {
            footerPanel.showParticipants("Bots détectés : aucun.");
            return;
        }
        if (bots.size() == 1) {
            footerPanel.showParticipants("Bot détecté : " + formatPlayerName(bots.get(0)));
            return;
        }
        footerPanel.showParticipants("Bots détectés : " + joinDecoratedNames(bots));
    }

    private String describePendingPlacement(NemesisSession session) {
        List<NemesisState.Player> pending = session.opponents().stream()
                .filter(player -> "placing".equalsIgnoreCase(player.status()))
                .collect(Collectors.toList());
        if (pending.isEmpty()) {
            return "";
        }
        if (pending.size() == 1) {
            return "En attente du placement de " + formatPlayerName(pending.get(0)) + ".";
        }
        return "En attente du placement de : " + joinDecoratedNames(pending) + ".";
    }

    private String describeOpponents(NemesisSession session) {
        List<NemesisState.Player> opponents = session.opponents().stream()
                .filter(player -> !"eliminated".equalsIgnoreCase(player.status()))
                .filter(player -> !"dead".equalsIgnoreCase(player.status()))
                .collect(Collectors.toList());
        if (opponents.isEmpty()) {
            return "";
        }
        return joinDecoratedNames(opponents);
    }

    private String describeCurrentTurnHolder(NemesisSession session) {
        NemesisState state = session.state();
        int turnIndex = state.turnIndex();
        if (turnIndex < 0 || turnIndex >= state.players().size()) {
            return "";
        }
        NemesisState.Player current = state.players().get(turnIndex);
        boolean isSelf = session.self().map(player -> player.id() == current.id()).orElse(false);
        if (isSelf) {
            return "";
        }
        return "Attente du tour de " + formatPlayerName(current) + ".";
    }

    private Optional<NemesisState.Player> findPlayerById(NemesisState state, Integer id) {
        if (id == null) {
            return Optional.empty();
        }
        return state.players().stream()
                .filter(player -> player.id() == id)
                .findFirst();
    }

    private String joinDecoratedNames(List<NemesisState.Player> players) {
        return players.stream()
                .map(this::formatPlayerName)
                .collect(Collectors.joining(", "));
    }

    private String formatPlayerName(NemesisState.Player player) {
        if (player == null) {
            return "Joueur inconnu";
        }
        String base = player.username();
        if (base == null || base.isBlank()) {
            base = "Joueur " + player.id();
        }
        return player.isBot() ? base + " (bot)" : base;
    }

    private String resolvePlayerName(Map<Integer, String> playerNames, Integer id) {
        if (id == null) {
            return "Joueur inconnu";
        }
        return playerNames.getOrDefault(id, "Joueur " + id);
    }

    private void showSetup() {
        state = ViewState.SETUP;
        controller.reset();
        placementPanel.clear();
        mainLayout.show(mainPanel, ViewState.SETUP.name());
        mainPanel.revalidate();
        mainPanel.repaint();
        placementPanel.clear();
        ownGrid.clear();
        enemyGrid.clear();
        historySidebar.clear();
        historyTracker.clear();
        footerPanel.reset();
        SwingUtilities.invokeLater(setupPanel::activate);
    }

    private void setStatus(String text) {
        footerPanel.showStatus(text);
        accessibilityService.announceCustom(footerPanel, text);
    }

    private void announceCurrentTurn() {
        NemesisSession session = currentSession;
        if (session == null) {
            setStatus("Aucune partie active.");
            return;
        }
        NemesisState state = session.state();
        if (state == null) {
            setStatus("Aucune information de partie disponible.");
            return;
        }
        if (state.winnerId() != null) {
            setStatus("La partie est terminée.");
            return;
        }
        List<NemesisState.Player> players = state.players();
        if (players == null || players.isEmpty()) {
            setStatus("Aucun joueur autour de la table.");
            return;
        }
        int index = state.turnIndex();
        if (index < 0 || index >= players.size()) {
            setStatus("Tour en cours inconnu.");
            return;
        }
        NemesisState.Player current = players.get(index);
        if (current == null) {
            setStatus("Tour en cours inconnu.");
            return;
        }
        String name = current.username();
        if (name == null || name.isBlank()) {
            name = "Joueur " + (index + 1);
        }
        StringBuilder message = new StringBuilder("Tour de ").append(name);
        if (current.isBot()) {
            message.append(" (bot)");
        }
        if (current.isSelf()) {
            message.append(" (vous)");
        }
        if (state.round() > 0) {
            message.append(" - Manche ").append(state.round());
        }
        setStatus(message.toString());
    }

    private void announceTableParticipants() {
        NemesisSession session = currentSession;
        if (session == null) {
            setStatus("Aucune partie active.");
            return;
        }
        NemesisState state = session.state();
        List<NemesisState.Player> players = state != null ? state.players() : null;
        if (players == null || players.isEmpty()) {
            setStatus("Aucun joueur autour de la table.");
            return;
        }
        StringBuilder builder = new StringBuilder();
        builder.append("Table de ").append(players.size())
                .append(players.size() > 1 ? " joueurs : " : " joueur : ");
        int selfId = session.self().map(NemesisState.Player::id).orElse(-1);
        for (int i = 0; i < players.size(); i++) {
            NemesisState.Player player = players.get(i);
            String name = player != null ? player.username() : null;
            String display = (name == null || name.isBlank()) ? "Joueur " + (i + 1) : name;
            if (player != null && player.id() == selfId) {
                display = display + " (vous)";
            }
            if (player != null && player.isBot()) {
                display = display + " (bot)";
            }
            builder.append(display);
            if (i < players.size() - 1) {
                builder.append(", ");
            }
        }
        setStatus(builder.toString());
    }

    private void exitToCatalog() {
        controller.reset();
        if (screenManager != null) {
            SwingUtilities.invokeLater(() -> screenManager.show(CatalogScreen.ID));
        }
    }

    @Override
    public ScreenId id() {
        return ID;
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        controller.addListener(sessionListener);
        dialogService.attach(this);
        showSetup();
        interactionController.setEnabled(true);
    }

    @Override
    public void onHide(ScreenContext context) {
        controller.removeListener(sessionListener);
        interactionController.setEnabled(false);
        this.screenManager = null;
    }
}





