package com.lemondelila.client.game.core.viewmodel;

import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.function.Function;

public final class PendingActionSelector {

    public int selectIndex(List<?> actions, String pendingType, Function<Object, String> actionTypeAccessor) {
        Objects.requireNonNull(actionTypeAccessor, "actionTypeAccessor");
        if (actions == null || actions.isEmpty()) {
            return -1;
        }
        if (pendingType == null || pendingType.isBlank()) {
            return 0;
        }
        String pending = pendingType.toLowerCase(Locale.ROOT);

        for (int i = 0; i < actions.size(); i++) {
            Object act = actions.get(i);
            String type = actionTypeAccessor.apply(act);
            if (type == null || type.isBlank()) continue;
            String t = type.toLowerCase(Locale.ROOT);

            if (pending.equals(t)) {
                return i;
            }
            if ("vote".equals(pending) && "day_vote".equals(t)) {
                return i;
            }
            if ("exchange".equals(pending) && t.contains("exchange")) {
                return i;
            }
        }
        return 0;
    }
}

