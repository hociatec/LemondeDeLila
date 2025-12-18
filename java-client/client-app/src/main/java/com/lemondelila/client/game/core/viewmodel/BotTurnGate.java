package com.lemondelila.client.game.core.viewmodel;

public final class BotTurnGate {

    public boolean shouldBlock(boolean tableStarted,
                               boolean botTurnLocked,
                               boolean activeQuiz,
                               boolean pendingAskForMe) {
        if (!tableStarted) {
            return false;
        }
        if (activeQuiz) {
            return false;
        }
        if (pendingAskForMe) {
            return false;
        }
        return botTurnLocked;
    }
}

