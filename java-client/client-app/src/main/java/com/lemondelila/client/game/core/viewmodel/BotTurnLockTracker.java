package com.lemondelila.client.game.core.viewmodel;

import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.room.model.TableState;

import java.util.Objects;
import java.util.function.Consumer;

public final class BotTurnLockTracker {

    private final TableState tableState;
    private boolean locked;
    private boolean notified;

    public BotTurnLockTracker(TableState tableState) {
        this.tableState = Objects.requireNonNull(tableState, "tableState");
    }

    public boolean locked() {
        return locked;
    }

    public void reset() {
        locked = false;
        notified = false;
    }

    public void update(GenericGameState state, Consumer<String> infoLabelSetter) {
        boolean botFlag = state != null && state.botThinking();
        if (!botFlag) {
            botFlag = isCurrentPlayerBot();
        }
        locked = botFlag;

        if (!locked) {
            notified = false;
            infoLabelSetter.accept("");
            return;
        }

        if (!notified) {
            infoLabelSetter.accept("Tour du bot, merci de patienter...");
            notified = true;
        }
    }

    private boolean isCurrentPlayerBot() {
        Integer currentId = tableState.currentPlayerId();
        if (currentId == null) {
            return false;
        }
        return tableState.bots().stream().anyMatch(b -> currentId.equals(b.id()));
    }
}

