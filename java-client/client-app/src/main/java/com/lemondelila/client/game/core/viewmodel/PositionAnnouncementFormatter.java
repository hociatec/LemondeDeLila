package com.lemondelila.client.game.core.viewmodel;

public final class PositionAnnouncementFormatter {

    public String formatPosition(int positionIndex, int totalTiles, int turnRound) {
        if (totalTiles > 0 && positionIndex >= 0) {
            return "Case " + (positionIndex + 1) + "/" + totalTiles + ", tour " + turnRound;
        }
        return "Tour " + turnRound;
    }
}

