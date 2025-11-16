package com.lemondelila.client.gamelogic.missionnemesis.presenter;

import com.lemondelila.client.gamelogic.missionnemesis.controller.NemesisController;
import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSession;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSpecs;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisState;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;
import com.lemondelila.client.gamelogic.missionnemesis.view.GameHistorySidebar;
import com.lemondelila.client.gamelogic.missionnemesis.view.NemesisGridPanel;
import com.lemondelila.client.gamelogic.missionnemesis.view.NemesisPlacementOrchestrator;
import com.lemondelila.client.gamelogic.missionnemesis.view.NemesisPlacementPanel;

import javax.swing.SwingUtilities;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

public final class NemesisGamePresenter {

    public interface ViewCallbacks {
        void showSetupView();
        void showBattleView();
    }

    private enum Mode {
        SETUP,
        MANUAL_PLACEMENT,
        ACTIVE_GAME
    }

    private final NemesisController controller;
    private final NemesisPlacementPanel placementPanel;
    private final NemesisGridPanel ownGrid;
    private final NemesisGridPanel enemyGrid;
    private final GameHistorySidebar historySidebar;
    private final NemesisSessionPresenter sessionPresenter;
    private final Consumer<String> statusConsumer;
    private final ViewCallbacks viewCallbacks;

    private NemesisPlacementOrchestrator placementOrchestrator;
    private NemesisSession currentSession;
    private Mode mode = Mode.SETUP;

    public NemesisGamePresenter(NemesisController controller,
                                NemesisPlacementPanel placementPanel,
                                NemesisGridPanel ownGrid,
                                NemesisGridPanel enemyGrid,
                                GameHistorySidebar historySidebar,
                                NemesisSessionPresenter sessionPresenter,
                                Consumer<String> statusConsumer,
                                ViewCallbacks viewCallbacks) {
        this.controller = Objects.requireNonNull(controller, "controller");
        this.placementPanel = Objects.requireNonNull(placementPanel, "placementPanel");
        this.ownGrid = Objects.requireNonNull(ownGrid, "ownGrid");
        this.enemyGrid = Objects.requireNonNull(enemyGrid, "enemyGrid");
        this.historySidebar = Objects.requireNonNull(historySidebar, "historySidebar");
        this.sessionPresenter = Objects.requireNonNull(sessionPresenter, "sessionPresenter");
        this.statusConsumer = Objects.requireNonNull(statusConsumer, "statusConsumer");
        this.viewCallbacks = Objects.requireNonNull(viewCallbacks, "viewCallbacks");
    }

    public void startGame(NemesisSetupPanel.Configuration configuration) {
        statusConsumer.accept("Création de la partie Mission Nemesis...");
        controller.startNewGame().whenComplete((session, error) ->
                SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        statusConsumer.accept("Impossible de créer la partie Mission Nemesis.");
                        return;
                    }
                    currentSession = session;
                    mode = configuration.placementMode() == NemesisSetupPanel.PlacementMode.MANUAL
                            ? Mode.MANUAL_PLACEMENT
                            : Mode.ACTIVE_GAME;
                    prepareBattleView();
                    handleSessionUpdate(session);
                    if (mode == Mode.MANUAL_PLACEMENT) {
                        startManualPlacement();
                    } else {
                        startAutoPlacement();
                    }
                })
        );
    }

    public void handleSessionUpdate(NemesisSession session) {
        this.currentSession = session;
        boolean placementComplete = sessionPresenter.displaySession(
                session,
                mode == Mode.MANUAL_PLACEMENT,
                placementPanel::showCombatHelp
        );
        if (placementComplete) {
            mode = Mode.ACTIVE_GAME;
        }
    }

    public void fireAt(GridCoordinate coordinate) {
        NemesisSession snapshot = currentSession;
        if (snapshot == null || !snapshot.isAwaitingCombatTurn()) {
            return;
        }
        statusConsumer.accept("Tir en cours sur " + sessionPresenter.describeCoordinate(coordinate) + "...");
        controller.fire(coordinate).whenComplete((result, error) ->
                SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        statusConsumer.accept("Tir impossible.");
                    } else {
                        statusConsumer.accept("Tir envoyé.");
                    }
                })
        );
    }

    public void resetToSetup() {
        mode = Mode.SETUP;
        currentSession = null;
        controller.reset();
        placementPanel.clear();
        historySidebar.clear();
        sessionPresenter.reset();
        ownGrid.clear();
        enemyGrid.clear();
        viewCallbacks.showSetupView();
    }

    public Optional<NemesisSession> currentSession() {
        return Optional.ofNullable(currentSession);
    }

    public boolean isManualPlacement() {
        return mode == Mode.MANUAL_PLACEMENT;
    }

    private void prepareBattleView() {
        placementPanel.clear();
        historySidebar.clear();
        viewCallbacks.showBattleView();
    }

    private void startAutoPlacement() {
        mode = Mode.ACTIVE_GAME;
        placementPanel.showAutoPlacementMessage();
        statusConsumer.accept("Placement automatique en cours...");
        List<ShipPlacement> placements = NemesisSpecs.defaultPlacements();
        controller.placeFleet(placements).whenComplete((session, error) ->
                SwingUtilities.invokeLater(() -> {
                    if (error != null) {
                        statusConsumer.accept("Placement automatique indisponible, passage en mode manuel.");
                        mode = Mode.MANUAL_PLACEMENT;
                        startManualPlacement();
                    } else {
                        statusConsumer.accept("Flotte placée automatiquement.");
                        mode = Mode.ACTIVE_GAME;
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
                                statusConsumer.accept("Impossible d’enregistrer le placement.");
                                resetToSetup();
                            } else {
                                statusConsumer.accept("Placement transmis. Préparation du combat...");
                                mode = Mode.ACTIVE_GAME;
                                placementPanel.showCombatHelp();
                            }
                        })
                ),
                this::cancelManualPlacement,
                statusConsumer
        );
        placementOrchestrator.start();
        statusConsumer.accept("Placement manuel : flèches pour naviguer, Entrée pour valider.");
    }

    private void cancelManualPlacement() {
        controller.reset();
        statusConsumer.accept("Placement annulé. Retour à la configuration.");
        resetToSetup();
    }
}
