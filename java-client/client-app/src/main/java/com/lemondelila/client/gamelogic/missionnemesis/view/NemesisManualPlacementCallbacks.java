package com.lemondelila.client.gamelogic.missionnemesis.view;

import com.lemondelila.client.gamelogic.missionnemesis.model.GridCoordinate;

interface NemesisManualPlacementCallbacks {
    void onSelectionChanged(GridCoordinate coordinate);

    void onConfirm(GridCoordinate coordinate);

    void onUndo();

    void onCancel();
}
