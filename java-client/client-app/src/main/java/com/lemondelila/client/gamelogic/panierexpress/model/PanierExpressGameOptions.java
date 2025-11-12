package com.lemondelila.client.gamelogic.panierexpress.model;

import java.util.Objects;

/**
 * Paramètres de lancement pour Panier Express.
 */
public final class PanierExpressGameOptions {

    public static final int DEFAULT_ROBOT_COUNT = 1;
    public static final int MIN_ROBOT_COUNT = 0;
    public static final int MAX_ROBOT_COUNT = 5;

    private final int robotCount;

    private PanierExpressGameOptions(int robotCount) {
        this.robotCount = robotCount;
    }

    public static PanierExpressGameOptions defaults() {
        return of(DEFAULT_ROBOT_COUNT);
    }

    public static PanierExpressGameOptions of(int robotCount) {
        int clamped = Math.max(MIN_ROBOT_COUNT, Math.min(MAX_ROBOT_COUNT, robotCount));
        return new PanierExpressGameOptions(clamped);
    }

    public int robotCount() {
        return robotCount;
    }

    public int totalSeats() {
        return 1 + robotCount;
    }

    public PanierExpressGameOptions withRobotCount(int value) {
        if (value == robotCount) {
            return this;
        }
        return of(value);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        PanierExpressGameOptions that = (PanierExpressGameOptions) o;
        return robotCount == that.robotCount;
    }

    @Override
    public int hashCode() {
        return Objects.hash(robotCount);
    }

    @Override
    public String toString() {
        return "PanierExpressGameOptions{robotCount=" + robotCount + '}';
    }
}

