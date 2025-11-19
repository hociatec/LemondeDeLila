package com.lemondelila.client.gamelogic.panierexpress.model;

/**
 * Paramètres minimaux pour lancer Panier Express côté client.
 * Seul le nombre de bots est configurable pour l'instant.
 */
public final class PanierExpressGameOptions {

    public static final int MIN_ROBOT_COUNT = 0;
    public static final int MAX_ROBOT_COUNT = 5;
    public static final int DEFAULT_ROBOT_COUNT = 1;

    private final int robotCount;

    private PanierExpressGameOptions(int robotCount) {
        this.robotCount = clamp(robotCount);
    }

    public static PanierExpressGameOptions defaults() {
        return new PanierExpressGameOptions(DEFAULT_ROBOT_COUNT);
    }

    public static PanierExpressGameOptions ofRobots(int robotCount) {
        return new PanierExpressGameOptions(robotCount);
    }

    public int robotCount() {
        return robotCount;
    }

    private static int clamp(int value) {
        if (value < MIN_ROBOT_COUNT) {
            return MIN_ROBOT_COUNT;
        }
        if (value > MAX_ROBOT_COUNT) {
            return MAX_ROBOT_COUNT;
        }
        return value;
    }
}

