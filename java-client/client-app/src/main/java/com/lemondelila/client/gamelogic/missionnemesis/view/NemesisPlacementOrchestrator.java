package com.lemondelila.client.gamelogic.missionnemesis.view;

import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.NemesisSpecs;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;

import java.awt.Toolkit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.stream.Collectors;

/**
 * Gere entierement le placement manuel d'une flotte en interaction
 * avec le panneau de grille dedie.
 */
final class NemesisPlacementOrchestrator implements NemesisGridPanel.ManualPlacementCallbacks {

    private final NemesisGridPanel grid;
    private final NemesisPlacementPanel infoPanel;
    private final Consumer<List<ShipPlacement>> completionHandler;
    private final Runnable cancelHandler;
    private final Consumer<String> statusUpdater;

    private final List<ShipTemplate> templates;
    private final boolean[][] occupied = new boolean[NemesisSpecs.BOARD_SIZE][NemesisSpecs.BOARD_SIZE];
    private final List<ShipPlacement> placements = new ArrayList<>();
    private final List<GridCoordinate> currentShipCells = new ArrayList<>();

    private Orientation orientation = Orientation.NONE;
    private int shipIndex;

    NemesisPlacementOrchestrator(NemesisGridPanel grid,
                                 NemesisPlacementPanel infoPanel,
                                 Consumer<List<ShipPlacement>> completionHandler,
                                 Runnable cancelHandler,
                                 Consumer<String> statusUpdater) {
        this.grid = Objects.requireNonNull(grid, "grid");
        this.infoPanel = Objects.requireNonNull(infoPanel, "infoPanel");
        this.completionHandler = Objects.requireNonNull(completionHandler, "completionHandler");
        this.cancelHandler = Objects.requireNonNull(cancelHandler, "cancelHandler");
        this.statusUpdater = Objects.requireNonNull(statusUpdater, "statusUpdater");
        this.templates = NemesisSpecs.ships().entrySet().stream()
                .map(entry -> new ShipTemplate(entry.getKey(), entry.getValue()))
                .collect(Collectors.toList());
    }

    void start() {
        clearState();
        infoPanel.showManualIntro(templates.size());
        grid.updateManualCommitted(placements);
        grid.updateManualCurrent(currentShipCells);
        grid.beginManualPlacement(this);
        updateProgress();
    }

    @Override
    public void onSelectionChanged(GridCoordinate coordinate) {
        statusUpdater.accept("Case selectionnee : " + formatCoordinate(coordinate));
    }

    @Override
    public void onConfirm(GridCoordinate coordinate) {
        if (shipIndex >= templates.size()) {
            return;
        }

        ShipTemplate template = templates.get(shipIndex);

        if (isOccupied(coordinate)) {
            warn("Cette case est deja occupee.");
            return;
        }
        if (currentShipCells.contains(coordinate)) {
            warn("Cette case est deja selectionnee pour ce vaisseau.");
            return;
        }
        if (currentShipCells.size() >= template.size()) {
            warn("Tous les segments de ce vaisseau sont deja places.");
            return;
        }
        if (!isCoordinateValidWithOrientation(coordinate)) {
            warn("Les segments doivent etre alignes et contigus.");
            return;
        }

        currentShipCells.add(coordinate);
        grid.updateManualCurrent(currentShipCells);
        updateProgress();

        if (currentShipCells.size() == template.size()) {
            finalizeCurrentShip();
        }
    }

    @Override
    public void onUndo() {
        if (!currentShipCells.isEmpty()) {
            currentShipCells.remove(currentShipCells.size() - 1);
            if (currentShipCells.size() < 2) {
                orientation = Orientation.NONE;
            }
            grid.updateManualCurrent(currentShipCells);
            updateProgress();
            statusUpdater.accept("Dernier segment retire.");
            return;
        }

        if (!placements.isEmpty()) {
            ShipPlacement removed = placements.remove(placements.size() - 1);
            removed.coordinates().forEach(coord -> occupied[coord.x()][coord.y()] = false);
            shipIndex = Math.max(0, shipIndex - 1);
            orientation = Orientation.NONE;
            currentShipCells.clear();
            grid.updateManualCommitted(placements);
            grid.updateManualCurrent(currentShipCells);
            updateProgress();
            statusUpdater.accept("Dernier vaisseau retire. Repositionnez-le.");
        }
    }

    @Override
    public void onCancel() {
        cancelHandler.run();
    }

    private void finalizeCurrentShip() {
        ShipTemplate template = templates.get(shipIndex);
        List<GridCoordinate> sorted = sortCurrentShip();

        placements.add(new ShipPlacement(template.name(), sorted));
        sorted.forEach(coord -> occupied[coord.x()][coord.y()] = true);

        grid.updateManualCommitted(placements);
        currentShipCells.clear();
        grid.updateManualCurrent(currentShipCells);

        shipIndex++;
        orientation = Orientation.NONE;

        if (shipIndex >= templates.size()) {
            infoPanel.showManualComplete();
            grid.endManualPlacement();
            completionHandler.accept(List.copyOf(placements));
        } else {
            updateProgress();
            statusUpdater.accept("Vaisseau valide. Passez au suivant.");
        }
    }

    private List<GridCoordinate> sortCurrentShip() {
        Comparator<GridCoordinate> comparator = orientation == Orientation.HORIZONTAL
                ? Comparator.comparingInt(GridCoordinate::x)
                : Comparator.comparingInt(GridCoordinate::y);
        return currentShipCells.stream()
                .sorted(comparator)
                .toList();
    }

    private boolean isCoordinateValidWithOrientation(GridCoordinate coordinate) {
        if (currentShipCells.isEmpty()) {
            return true;
        }

        GridCoordinate first = currentShipCells.get(0);
        if (orientation == Orientation.NONE) {
            int dx = Math.abs(coordinate.x() - first.x());
            int dy = Math.abs(coordinate.y() - first.y());
            if (dx + dy != 1) {
                return false;
            }
            orientation = dx == 1 ? Orientation.HORIZONTAL : Orientation.VERTICAL;
            return true;
        }

        if (orientation == Orientation.HORIZONTAL) {
            if (coordinate.y() != first.y()) {
                return false;
            }
            int minX = currentShipCells.stream().mapToInt(GridCoordinate::x).min().orElse(first.x());
            int maxX = currentShipCells.stream().mapToInt(GridCoordinate::x).max().orElse(first.x());
            return coordinate.x() == minX - 1 || coordinate.x() == maxX + 1;
        } else {
            if (coordinate.x() != first.x()) {
                return false;
            }
            int minY = currentShipCells.stream().mapToInt(GridCoordinate::y).min().orElse(first.y());
            int maxY = currentShipCells.stream().mapToInt(GridCoordinate::y).max().orElse(first.y());
            return coordinate.y() == minY - 1 || coordinate.y() == maxY + 1;
        }
    }

    private boolean isOccupied(GridCoordinate coordinate) {
        return occupied[coordinate.x()][coordinate.y()];
    }

    private void updateProgress() {
        if (shipIndex >= templates.size()) {
            return;
        }
        ShipTemplate template = templates.get(shipIndex);
        infoPanel.updateManualProgress(
                template.name(),
                shipIndex + 1,
                templates.size(),
                currentShipCells.size(),
                template.size()
        );
        statusUpdater.accept("Placez le vaisseau \"" + template.name() + "\" (" + template.size() + " segments).");
    }

    private void warn(String message) {
        statusUpdater.accept(message);
        Toolkit.getDefaultToolkit().beep();
    }

    private void clearState() {
        shipIndex = 0;
        placements.clear();
        currentShipCells.clear();
        orientation = Orientation.NONE;
        for (int y = 0; y < NemesisSpecs.BOARD_SIZE; y++) {
            for (int x = 0; x < NemesisSpecs.BOARD_SIZE; x++) {
                occupied[x][y] = false;
            }
        }
        grid.clearManualState();
    }

    private String formatCoordinate(GridCoordinate coordinate) {
        return (coordinate.x() + 1) + "," + (coordinate.y() + 1);
    }

    private enum Orientation {
        NONE,
        HORIZONTAL,
        VERTICAL
    }

    private record ShipTemplate(String name, int size) {
    }
}




