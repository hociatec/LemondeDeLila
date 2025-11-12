package com.lemondelila.client.gamelogic.missionnemesis.view;

import com.lemondelila.client.gamelogic.missionnemesis.controller.NemesisController;
import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSpecs;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;
import com.lemondelila.framework.access.game.AccessibilityService;
import com.lemondelila.framework.access.game.GameHistoryTracker;
import com.lemondelila.framework.access.shortcut.AccessibleShortcutRegistry;
import com.lemondelila.framework.core.di.Inject;
import com.lemondelila.framework.ui.screen.Screen;
import com.lemondelila.framework.ui.screen.ScreenContext;
import com.lemondelila.framework.ui.screen.ScreenManager;

import javax.swing.AbstractAction;
import javax.swing.BorderFactory;
import javax.swing.JPanel;
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
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public final class NemesisScreen extends JPanel implements Screen {

    private enum ViewState {
        SETUP,
        MANUAL_PLACEMENT,
        ACTIVE_GAME
    }

    private final NemesisController controller;
    private final AccessibilityService accessibilityService;
    private final AccessibleShortcutRegistry shortcutRegistry;

    private ScreenManager screenManager;
    private NemesisSession currentSession;
    private ViewState state = ViewState.SETUP;

    private final NemesisSetupPanel setupPanel;
    private final NemesisPlacementPanel placementPanel = new NemesisPlacementPanel();
    private final NemesisLogPanel logPanel = new NemesisLogPanel();
    private final NemesisFooterPanel footerPanel;
    private final NemesisGridPanel ownGrid;
    private final NemesisGridPanel enemyGrid;
    private final CardLayout mainLayout = new CardLayout();
    private final JPanel mainPanel = new JPanel(mainLayout);

    private NemesisPlacementOrchestrator placementOrchestrator;
    private NemesisSetupPanel.Configuration lastConfiguration;

    private final Consumer<NemesisSession> sessionListener = this::displaySession;

    @Inject
    public NemesisScreen(NemesisController controller,
                         NemesisSessionStore sessionStore,
                         AccessibilityService accessibilityService,
                         AccessibleShortcutRegistry shortcutRegistry) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.accessibilityService = Objects.requireNonNull(accessibilityService, "accessibilityService");
        this.shortcutRegistry = Objects.requireNonNull(shortcutRegistry, "shortcutRegistry");
        Objects.requireNonNull(sessionStore, "sessionStore");
        this.ownGrid = new NemesisGridPanel(true, coordinate -> {});
        this.enemyGrid = new NemesisGridPanel(false, this::fireAt);
        this.setupPanel = new NemesisSetupPanel(new int[]{NemesisSpecs.BOARD_SIZE}, this::handleStartRequested);
        this.footerPanel = new NemesisFooterPanel(accessibilityService);

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
        battleContainer.add(logPanel, BorderLayout.SOUTH);

        mainPanel.add(setupContainer, ViewState.SETUP.name());
        mainPanel.add(battleContainer, ViewState.ACTIVE_GAME.name());

        add(mainPanel, BorderLayout.CENTER);
        add(footerPanel, BorderLayout.SOUTH);

        showSetup();
    }

    private void configureKeyMap() {
        shortcutRegistry.clear();
        registerShortcut("ESCAPE", "nemesis-reset", "Échap : revenir à la configuration.", e -> {
            controller.reset();
            showSetup();
            setStatus("Partie réinitialisée.");
        });

        registerShortcut("F5", "nemesis-refresh", "F5 : rafraîchir l’état de la partie.", e -> {
            if (currentSession == null) {
                return;
            }
            setStatus("Rafraîchissement de l’état en cours...");
            controller.refresh().whenComplete((session, error) ->
                    SwingUtilities.invokeLater(() -> {
                        if (error != null) {
                            setStatus("Impossible de rafraîchir l’état de la partie.");
                        } else {
                            setStatus("État mis à jour.");
                        }
                    })
            );
        });
        shortcutRegistry.applyTo(this);
    }
    private void registerShortcut(String keyStroke, String actionId, String description, java.util.function.Consumer<java.awt.event.ActionEvent> handler) {
        registerShortcut(KeyStroke.getKeyStroke(keyStroke), actionId, description, handler);
    }

    private void registerShortcut(KeyStroke stroke, String actionId, String description, java.util.function.Consumer<java.awt.event.ActionEvent> handler) {
        if (stroke == null || handler == null) {
            return;
        }
        getInputMap(WHEN_IN_FOCUSED_WINDOW).put(stroke, actionId);
        getActionMap().put(actionId, new AbstractAction() {
            @Override
            public void actionPerformed(java.awt.event.ActionEvent e) {
                handler.accept(e);
            }
        });
        if (description != null && !description.isBlank()) {
            shortcutRegistry.register(stroke, description);
        }
    }


    private void handleStartRequested(NemesisSetupPanel.Configuration configuration) {
        this.lastConfiguration = configuration;
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
                    logPanel.clear();
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
        ownGrid.renderOwn(session);
        enemyGrid.renderEnemy(session);
        enemyGrid.setFiringEnabled(session.isAwaitingCombatTurn(), session);
        if (session.isAwaitingCombatTurn()) {
            enemyGrid.setFireSelectionListener(this::updateSelectionStatus);
        } else {
            enemyGrid.setFireSelectionListener(null);
        }

        updateLog(session);
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
                    setStatus("Partie terminée. Vainqueur : Joueur " + score.winnerId());
                } else {
                    setStatus("Partie terminée. Égalité.");
                }
            }, () -> setStatus("Partie terminée."));
        } else if (session.isPlacementRequired() && state != ViewState.MANUAL_PLACEMENT) {
            setStatus("Attente du placement adverse...");
        } else if (session.isAwaitingCombatTurn()) {
            setStatus("Choisissez une case à l’aide des flèches puis validez avec Entrée.");
            placementPanel.showCombatHelp();
        } else {
            setStatus("Attente du tour adverse...");
        }
    }

    private void updateLog(NemesisSession session) {
        StringBuilder builder = new StringBuilder();
        Map<Integer, String> playerNames = new HashMap<>();
        session.state().players().forEach(player -> playerNames.put(player.id(), player.username()));
        session.state().log().forEach(entry -> {
            String line = formatLogEntry(entry, playerNames);
            if (!line.isBlank()) {
                builder.append(line).append(System.lineSeparator());
            }
        });
        logPanel.showLog(builder.toString());
    }

    private String formatLogEntry(NemesisState.LogEntry entry, Map<Integer, String> playerNames) {
        String type = entry.type() != null ? entry.type() : "";
        return switch (type) {
            case "phase" -> "Phase : " + (entry.message() != null ? entry.message() : "");
            case "shot" -> {
                String shooter = playerNames.getOrDefault(entry.fromPlayerId(), "Joueur " + entry.fromPlayerId());
                String target = playerNames.getOrDefault(entry.targetPlayerId(), "Joueur " + entry.targetPlayerId());
                String result = entry.result() != null ? entry.result() : "inconnu";
                yield shooter + " tire sur " + target + " (" + entry.x() + "," + entry.y() + ") : " + result;
            }
            case "elimination" -> {
                String shooter = playerNames.getOrDefault(entry.fromPlayerId(), String.valueOf(entry.fromPlayerId()));
                String target = playerNames.getOrDefault(entry.targetPlayerId(), String.valueOf(entry.targetPlayerId()));
                yield "Joueur " + shooter + " Alimine " + target;
            }
            default -> entry.message() != null ? entry.message() : "";
        };
    }

    private void updateSelectionStatus(GridCoordinate coordinate) {
        setStatus("Cible : " + formatCoordinateHuman(coordinate) + ". Entrée pour tirer.");
    }

    private String formatCoordinateHuman(GridCoordinate coordinate) {
        return "(" + (coordinate.x() + 1) + "," + (coordinate.y() + 1) + ")";
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
        logPanel.clear();
        footerPanel.reset();
        SwingUtilities.invokeLater(setupPanel::activate);
    }

    private void setStatus(String text) {
        footerPanel.showStatus(text);
        accessibilityService.announceCustom(footerPanel, text);
    }

    @Override
    public String id() {
        return "mission-nemesis";
    }

    @Override
    public JPanel getComponent() {
        return this;
    }

    @Override
    public void onShow(ScreenContext context) {
        this.screenManager = context.screenManager();
        controller.addListener(sessionListener);
        showSetup();
    }

    @Override
    public void onHide(ScreenContext context) {
        controller.removeListener(sessionListener);
        this.screenManager = null;
    }
}


