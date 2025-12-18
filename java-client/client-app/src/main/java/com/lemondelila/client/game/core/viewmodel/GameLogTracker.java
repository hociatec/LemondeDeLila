package com.lemondelila.client.game.core.viewmodel;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public final class GameLogTracker {

    private final GameAnnouncementFormatter formatter;
    private int lastLogCount;

    public GameLogTracker(GameAnnouncementFormatter formatter) {
        this.formatter = Objects.requireNonNull(formatter, "formatter");
    }

    public List<String> consumeNewAnnouncements(List<String> logs, boolean gameStarted) {
        if (!gameStarted || logs == null) {
            return List.of();
        }
        if (logs.size() < lastLogCount) {
            lastLogCount = 0;
        }
        List<String> out = new ArrayList<>();
        for (int i = lastLogCount; i < logs.size(); i++) {
            String line = logs.get(i);
            if (line == null || line.isBlank()) continue;
            out.add(formatter.sanitizeLogLine(line));
        }
        lastLogCount = logs.size();
        return out;
    }

    public void reset() {
        lastLogCount = 0;
    }
}

