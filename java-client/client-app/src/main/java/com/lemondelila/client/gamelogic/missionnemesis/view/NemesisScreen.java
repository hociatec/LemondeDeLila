package com.lemondelila.client.gamelogic.missionnemesis.view;

import com.lemondelila.client.gamelogic.missionnemesis.controller.NemesisController;
import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSessionStore;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSpecs;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;
import com.lemondelila.framework.ui.screen.Screen;
import com.lemondelila.framework.ui.screen.ScreenContext;
import com.lemondelila.framework.ui.screen.ScreenManager;

import javax.swing.BorderFactory;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import java.awt.BorderLayout;
import java.awt.GridLayout;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public final class NemesisScreen extends JPanel implements Screen {

    private final NemesisController controller;
    private final NemesisSessionStore sessionStore;

    private ScreenManager screenManager;
    private NemesisSession currentSession;

    private final NemesisControlsPanel controlsPanel = new NemesisControlsPanel();
    private final NemesisLogPanel logPanel = new NemesisLogPanel();
    private final NemesisFooterPanel footerPanel = new NemesisFooterPanel();

    private final NemesisGridPanel ownGrid;
    private final NemesisGridPanel enemyGrid;

    private final Consumer<NemesisSession> sessionListener = this::displaySession;

    public NemesisScreen(NemesisController controller,
                                NemesisSessionStore sessionStore) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.sessionStore = Objects.requireNonNull(sessionStore, "sessionStore");
        this.ownGrid = new NemesisGridPanel(true, coordinate -> {});
        this.enemyGrid = new NemesisGridPanel(false, this::fireAt);
        buildUi();
        installHandlers();
    }

    private void buildUi() {
        setLayout(new BorderLayout(16, 16));
        setBorder(BorderFactory.createEmptyBorder(24, 32, 24, 32));

        add(new NemesisHeaderPanel(), BorderLayout.NORTH);

        JPanel gridsContainer = new JPanel(new GridLayout(1, 2, 16, 16));
        gridsContainer.add(ownGrid);
        gridsContainer.add(enemyGrid);

        JPanel center = new JPanel(new BorderLayout(12, 12));
        center.add(controlsPanel, BorderLayout.NORTH);
        center.add(gridsContainer, BorderLayout.CENTER);
        center.add(logPanel, BorderLayout.SOUTH);

        add(center, BorderLayout.CENTER);
        add(footerPanel, BorderLayout.SOUTH);

        clearView();
    }

    private void installHandlers() {
        controlsPanel.startButton().addActionListener(e -> {
            setStatus("Creation de la partie...");
            runAsync(controller.startNewGame(), "Partie Mission Nemesis initialisee.");
        });

        controlsPanel.autoPlaceButton().addActionListener(e -> {
            NemesisSession snapshot = currentSession;
            if (snapshot == null || !snapshot.isPlacementRequired()) {
                return;
            }
            setStatus("Placement automatique en cours...");
            List<ShipPlacement> placements = NemesisSpecs.defaultPlacements();
            runAsync(controller.placeFleet(placements), "Flotte placee.");
        });

        controlsPanel.refreshButton().addActionListener(e -> {
            setStatus("Rafraichissement de l'etat...");
            runAsync(controller.refresh(), "Etat mis a jour.");
        });

        controlsPanel.resetButton().addActionListener(e -> {
            controller.reset();
            clearView();
            setStatus("Partie reinitialisee.");
        });
    }

    private void runAsync(CompletableFuture<?> future, String successMessage) {
        future.whenComplete((result, error) -> SwingUtilities.invokeLater(() -> {
            if (error != null) {
                setStatus("Action echouee.");
            } else {
                setStatus(successMessage);
            }
        }));
    }

    private void fireAt(GridCoordinate coordinate) {
        NemesisSession snapshot = currentSession;
        if (snapshot == null || !snapshot.isAwaitingCombatTurn()) {
            return;
        }
        setStatus("Tir en cours sur (" + coordinate.x() + "," + coordinate.y() + ")...");
        runAsync(controller.fire(coordinate), "Tir envoye.");
    }

    private void displaySession(NemesisSession session) {
        this.currentSession = session;
        ownGrid.renderOwn(session);
        enemyGrid.renderEnemy(session);
        updateControls(session);
        updateLog(session);
        updateMetadata(session);
    }

    private void updateControls(NemesisSession session) {
        controlsPanel.setAutoPlacementEnabled(session.isPlacementRequired());
        controlsPanel.setRefreshEnabled(true);
        controlsPanel.setResetEnabled(true);
        enemyGrid.setFiringEnabled(session.isAwaitingCombatTurn(), session);
    }

    private void updateMetadata(NemesisSession session) {
        String phase = session.isPlacementRequired() ? "Placement" : session.finished() ? "Terminee" : "Combat";
        footerPanel.showRound(session.state().round());
        footerPanel.showPhase(phase);

        if (session.finished()) {
            session.score().ifPresentOrElse(score -> {
                if (score.winnerId() != null) {
                    setStatus("Partie terminee. Vainqueur : Joueur " + score.winnerId());
                } else {
                    setStatus("Partie terminee. Egalite.");
                }
            }, () -> setStatus("Partie terminee."));
        } else if (session.isPlacementRequired()) {
            setStatus("Placez votre flotte (placement automatique disponible).");
        } else if (session.isAwaitingCombatTurn()) {
            setStatus("A vous de tirer !");
        } else {
            setStatus("Attente de l'adversaire...");
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
                yield "Joueur " + shooter + " elimine " + target;
            }
            default -> entry.message() != null ? entry.message() : "";
        };
    }

    private void clearView() {
        currentSession = null;
        ownGrid.clear();
        enemyGrid.clear();
        controlsPanel.resetState();
        logPanel.clear();
        footerPanel.reset();
    }

    private void setStatus(String text) {
        footerPanel.showStatus(text);
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
        controller.currentSession().ifPresentOrElse(this::displaySession, this::clearView);
    }

    @Override
    public void onHide(ScreenContext context) {
        controller.removeListener(sessionListener);
        this.screenManager = null;
    }
}

