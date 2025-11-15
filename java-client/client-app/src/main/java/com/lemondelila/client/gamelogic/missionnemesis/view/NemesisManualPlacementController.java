package com.lemondelila.client.gamelogic.missionnemesis.view;

import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;
import com.lemondelila.client.gamelogic.missionnemesis.model.ShipPlacement;

import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * Encapsule la logique d’état pour le placement manuel (cases engagées vs en cours).
 */
final class NemesisManualPlacementController {

    private final boolean[][] committed;
    private final boolean[][] current;
    private NemesisManualPlacementCallbacks callbacks;
    private boolean active;

    NemesisManualPlacementController(int boardSize) {
        this.committed = new boolean[boardSize][boardSize];
        this.current = new boolean[boardSize][boardSize];
    }

    void begin(NemesisManualPlacementCallbacks callbacks) {
        this.callbacks = callbacks;
        this.active = true;
        clear();
    }

    void end() {
        this.active = false;
        this.callbacks = null;
        clear();
    }

    void clear() {
        for (int y = 0; y < committed[0].length; y++) {
            for (int x = 0; x < committed.length; x++) {
                committed[x][y] = false;
                current[x][y] = false;
            }
        }
    }

    void updateCurrent(List<GridCoordinate> coordinates) {
        reset(current);
        if (coordinates != null) {
            for (GridCoordinate coordinate : coordinates) {
                current[coordinate.x()][coordinate.y()] = true;
            }
        }
    }

    void updateCommitted(Collection<ShipPlacement> placements) {
        reset(committed);
        if (placements != null) {
            for (ShipPlacement placement : placements) {
                for (GridCoordinate coordinate : placement.coordinates()) {
                    committed[coordinate.x()][coordinate.y()] = true;
                }
            }
        }
    }

    boolean isActive() {
        return active;
    }

    boolean[][] committedGrid() {
        return committed;
    }

    boolean[][] currentGrid() {
        return current;
    }

    void notifySelectionChanged(GridCoordinate selection) {
        Optional.ofNullable(callbacks).ifPresent(cb -> cb.onSelectionChanged(selection));
    }

    void confirm(GridCoordinate selection) {
        Optional.ofNullable(callbacks).ifPresent(cb -> cb.onConfirm(selection));
    }

    void undo() {
        Optional.ofNullable(callbacks).ifPresent(NemesisManualPlacementCallbacks::onUndo);
    }

    void cancel() {
        Optional.ofNullable(callbacks).ifPresent(NemesisManualPlacementCallbacks::onCancel);
    }

    private static void reset(boolean[][] grid) {
        for (int y = 0; y < grid[0].length; y++) {
            for (int x = 0; x < grid.length; x++) {
                grid[x][y] = false;
            }
        }
    }
}
