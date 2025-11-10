package com.lemondelila.client.gamelogic.damenature.model;

public record DameNatureConfig(int botCount,
                               boolean includeDangerCards,
                               boolean includeQuizCards) {

    public DameNatureConfig {
        if (botCount < 1) {
            botCount = 1;
        }
        if (botCount > 3) {
            botCount = 3;
        }
    }

    public static DameNatureConfig defaultConfig() {
        return new DameNatureConfig(3, true, true);
    }

    public DameNatureConfig withBotCount(int count) {
        return new DameNatureConfig(Math.max(1, Math.min(3, count)), includeDangerCards, includeQuizCards);
    }

    public DameNatureConfig withIncludeDanger(boolean include) {
        return new DameNatureConfig(botCount, include, includeQuizCards);
    }

    public DameNatureConfig withIncludeQuiz(boolean include) {
        return new DameNatureConfig(botCount, includeDangerCards, include);
    }

    @Override
    public String toString() {
        return "DameNatureConfig{" +
                "botCount=" + botCount +
                ", includeDangerCards=" + includeDangerCards +
                ", includeQuizCards=" + includeQuizCards +
                '}';
    }
}
