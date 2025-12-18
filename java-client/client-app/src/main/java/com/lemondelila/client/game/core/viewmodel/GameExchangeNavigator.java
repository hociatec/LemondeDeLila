package com.lemondelila.client.game.core.viewmodel;

public final class GameExchangeNavigator {

    private int lastAnnouncedIndex = -1;

    public int nextIndex(int currentIndex, int size, int delta) {
        if (size <= 0) {
            return -1;
        }
        int current = currentIndex;
        if (current < 0 || current >= size) {
            current = 0;
        } else {
            current = (current + delta) % size;
            if (current < 0) {
                current += size;
            }
        }
        return current;
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

