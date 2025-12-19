package com.lemondelila.client.game.core.viewmodel;

import java.util.Objects;

public final class TurnAnnouncementTracker {

    private Integer lastTurnIndexSeen;
    private Integer lastAnnouncedPlayerId;
    private boolean pregameAnnounced;

    public record Decision(
            boolean announce,
            Integer nextLastTurnIndexSeen,
            Integer nextLastAnnouncedPlayerId,
            boolean nextPregameAnnounced
    ) {}

    public Decision decide(boolean tableStarted,
                           Integer currentPlayerId,
                           int turnIndex,
                           int round,
                           boolean hadTurnInfo,
                           boolean forcePregameAnnouncement) {
        if (!hadTurnInfo) {
            lastTurnIndexSeen = null;
            lastAnnouncedPlayerId = null;
            if (!tableStarted && !pregameAnnounced && forcePregameAnnouncement) {
                pregameAnnounced = true;
                return new Decision(true, null, null, true);
            }
            return new Decision(false, null, null, pregameAnnounced);
        }

        if (!tableStarted) {
            lastTurnIndexSeen = null;
            lastAnnouncedPlayerId = null;
            if (!pregameAnnounced && forcePregameAnnouncement) {
                pregameAnnounced = true;
                return new Decision(true, null, null, true);
            }
            return new Decision(false, null, null, pregameAnnounced);
        }

        if (turnIndex < 0 && currentPlayerId == null) {
            lastTurnIndexSeen = null;
            lastAnnouncedPlayerId = null;
            return new Decision(false, null, null, pregameAnnounced);
        }

        boolean alreadyAnnounced = false;
        if (currentPlayerId != null) {
            alreadyAnnounced = Objects.equals(currentPlayerId, lastAnnouncedPlayerId);
        } else if (lastTurnIndexSeen != null) {
            alreadyAnnounced = Objects.equals(lastTurnIndexSeen, turnIndex);
        }

        boolean announce = !alreadyAnnounced || !Objects.equals(lastTurnIndexSeen, turnIndex);
        if (announce) {
            lastTurnIndexSeen = turnIndex;
            lastAnnouncedPlayerId = currentPlayerId;
        }
        return new Decision(announce, lastTurnIndexSeen, lastAnnouncedPlayerId, pregameAnnounced);
    }

    public void reset() {
        lastTurnIndexSeen = null;
        lastAnnouncedPlayerId = null;
        pregameAnnounced = false;
    }

    public void clearLastSeen() {
        lastTurnIndexSeen = null;
        lastAnnouncedPlayerId = null;
    }

    public void markPregameAnnounced() {
        pregameAnnounced = true;
    }
}
