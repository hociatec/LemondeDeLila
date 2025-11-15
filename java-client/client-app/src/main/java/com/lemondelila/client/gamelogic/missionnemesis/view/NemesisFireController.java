package com.lemondelila.client.gamelogic.missionnemesis.view;

import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;

final class NemesisFireController {

    private final boolean[][] fireDisabled;

    NemesisFireController(int size) {
        this.fireDisabled = new boolean[size][size];
        disableAll();
    }

    void disableAll() {
        for (int y = 0; y < fireDisabled[0].length; y++) {
            for (int x = 0; x < fireDisabled.length; x++) {
                fireDisabled[x][y] = true;
            }
        }
    }

    void setDisabled(int x, int y, boolean disabled) {
        fireDisabled[x][y] = disabled;
    }

    boolean isDisabled(int x, int y) {
        return fireDisabled[x][y];
    }

    GridCoordinate firstAvailable() {
        for (int y = 0; y < fireDisabled[0].length; y++) {
            for (int x = 0; x < fireDisabled.length; x++) {
                if (!fireDisabled[x][y]) {
                    return new GridCoordinate(x, y);
                }
            }
        }
        return null;
    }

    GridCoordinate next(GridCoordinate start, int deltaX, int deltaY) {
        if (start == null) {
            return firstAvailable();
        }
        if (deltaX == 0 && deltaY == 0) {
            return start;
        }
        int size = fireDisabled.length;
        int x = start.x();
        int y = start.y();
        for (int step = 0; step < size; step++) {
            x = Math.floorMod(x + deltaX, size);
            y = Math.floorMod(y + deltaY, size);
            if (!fireDisabled[x][y]) {
                return new GridCoordinate(x, y);
            }
        }
        return null;
    }
}
