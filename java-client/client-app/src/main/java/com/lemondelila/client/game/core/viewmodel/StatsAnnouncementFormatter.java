package com.lemondelila.client.game.core.viewmodel;

public final class StatsAnnouncementFormatter {

    public String format(int pollution, int maxPollution, int books, int familyGoal) {
        return String.format("Pollution: %d/%d | Familles complétées: %d/%d", pollution, maxPollution, books, familyGoal);
    }
}

