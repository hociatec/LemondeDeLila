package com.lemondelila.client.game.core.view;

import com.lemondelila.client.game.core.model.GenericGameState;
import com.lemondelila.client.game.core.viewmodel.GameAnnouncementFormatter;
import com.lemondelila.client.game.core.viewmodel.GameLogTracker;
import com.lemondelila.client.game.room.model.TableState;
import com.lemondelila.client.game.turn.view.GameStatusPanel;

import java.util.List;
import java.util.Objects;
import java.util.function.Consumer;

public final class GameStatusRenderer {

    private final GameStatusPanel statusPanel;
    private final TableState tableState;
    private final Consumer<String> announcer;
    private final GameLogTracker logTracker;

    public GameStatusRenderer(GameStatusPanel statusPanel,
                              TableState tableState,
                              Consumer<String> announcer,
                              GameAnnouncementFormatter announcementFormatter) {
        this.statusPanel = Objects.requireNonNull(statusPanel, "statusPanel");
        this.tableState = Objects.requireNonNull(tableState, "tableState");
        this.announcer = Objects.requireNonNull(announcer, "announcer");
        this.logTracker = new GameLogTracker(Objects.requireNonNull(announcementFormatter, "announcementFormatter"));
    }

    public void clear() {
        statusPanel.clear();
    }

    public void resetLogs() {
        logTracker.reset();
    }

    public void reset() {
        clear();
        resetLogs();
    }

    public void renderHeader(GenericGameState state) {
        if (state == null) {
            statusPanel.clear();
            return;
        }
        statusPanel.update(state.status(), state.phase(), state.round(), state.turnIndex(), state.lastRoll());
        tableState.updateStatus(state.status());
    }

    public void renderTurnStatus(GenericGameState state, int round, int turnIndex) {
        if (state == null) {
            return;
        }
        statusPanel.update(state.status(), state.phase(), round, turnIndex, state.lastRoll());
    }

    public void renderLogs(List<String> logs) {
        for (String announcement : logTracker.consumeNewAnnouncements(logs, tableState.started())) {
            announcer.accept(announcement);
        }
    }
}

