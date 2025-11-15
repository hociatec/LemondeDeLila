package com.lemondelila.client.game.launcher;

import com.lemondelila.client.catalogue.model.GameSummary;

import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

public final class GameLauncherRegistry {

    private final Map<String, GameLauncher> launchers = new ConcurrentHashMap<>();

    public void register(String identifier, GameLauncher launcher) {
        Objects.requireNonNull(identifier, "identifier");
        Objects.requireNonNull(launcher, "launcher");
        launchers.put(normalize(identifier), launcher);
    }

    public Optional<GameLauncher> find(GameSummary summary) {
        if (summary == null) {
            return Optional.empty();
        }
        String identifier = summary.engine();
        if (identifier == null || identifier.isBlank()) {
            identifier = summary.code();
        }
        if (identifier == null || identifier.isBlank()) {
            return Optional.empty();
        }
        return Optional.ofNullable(launchers.get(normalize(identifier)));
    }

    private static String normalize(String identifier) {
        return identifier.trim().toLowerCase(Locale.ROOT);
    }
}
