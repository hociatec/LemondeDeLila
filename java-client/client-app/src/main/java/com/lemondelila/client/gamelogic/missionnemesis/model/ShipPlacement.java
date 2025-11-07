package com.lemondelila.client.gamelogic.missionnemesis.model;

import java.util.ArrayList;
import java.util.List;

public final class ShipPlacement {

    private final String name;
    private final List<GridCoordinate> coordinates;

    public ShipPlacement(String name, List<GridCoordinate> coordinates) {
        this.name = name;
        this.coordinates = List.copyOf(new ArrayList<>(coordinates));
    }

    public String name() {
        return name;
    }

    public List<GridCoordinate> coordinates() {
        return coordinates;
    }
}
