package com.lemondelila.client.game.core.viewmodel;

public final class GameExchangeNavigator {

    private int lastAnnouncedIndex = -1;

    public int nextIndex(int currentIndex, int size, int delta) {
        if (size <= 0) {
            return -1;
        }
        if (currentIndex < 0 || currentIndex >= size) {
            return delta < 0 ? size - 1 : 0;
        }
        if (delta == 0) {
            return currentIndex;
        }
        int candidate = currentIndex + delta;
        int normalized = Math.floorMod(candidate, size);
        return normalized;
    }

    public boolean shouldAnnounce(int index, boolean exchangePending, int size) {
        if (!exchangePending || size <= 0) {
            lastAnnouncedIndex = -1;
            return false;
        }
        if (index == lastAnnouncedIndex) {
            return false;
        }
        lastAnnouncedIndex = index;
        return true;
    }

    public void reset() {
        lastAnnouncedIndex = -1;
    }
}
