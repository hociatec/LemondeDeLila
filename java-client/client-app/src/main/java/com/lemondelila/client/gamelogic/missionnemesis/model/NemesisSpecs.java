package com.lemondelila.client.gamelogic.missionnemesis.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class NemesisSpecs {

    public static final int BOARD_SIZE = 10;

    private static final Map<String, Integer> SHIPS;

    static {
        Map<String, Integer> ships = new LinkedHashMap<>();
        ships.put("Station spatiale", 5);
        ships.put("Trou noir stabilise", 4);
        ships.put("Asteroide defensif", 3);
        ships.put("Satellite longue portee", 3);
        ships.put("Sonde de reconnaissance", 2);
        SHIPS = Map.copyOf(ships);
    }

    private NemesisSpecs() {
    }

    public static Map<String, Integer> ships() {
        return SHIPS;
    }

    public static List<ShipPlacement> defaultPlacements() {
        List<ShipPlacement> placements = new ArrayList<>();
        int row = 0;
        for (Map.Entry<String, Integer> entry : SHIPS.entrySet()) {
            List<GridCoordinate> coordinates = new ArrayList<>();
            for (int offset = 0; offset < entry.getValue(); offset++) {
                coordinates.add(new GridCoordinate(row, offset));
            }
            placements.add(new ShipPlacement(entry.getKey(), coordinates));
            row = Math.min(row + 1, BOARD_SIZE - 1);
        }
        return placements;
    }
}
