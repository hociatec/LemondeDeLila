package com.lemondelila.client.game.launcher;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

/**
 * Small descriptor linking a launcher to one or more game identifiers.
 */
public final class GameLauncherBinding {

    private final List<String> identifiers;
    private final GameLauncher launcher;

    public GameLauncherBinding(Collection<String> identifiers, GameLauncher launcher) {
        Objects.requireNonNull(identifiers, "identifiers");
        if (identifiers.isEmpty()) {
            throw new IllegalArgumentException("At least one identifier is required");
        }
        this.identifiers = List.copyOf(identifiers);
        this.launcher = Objects.requireNonNull(launcher, "launcher");
    }

    public static GameLauncherBinding of(GameLauncher launcher, String... identifiers) {
        Objects.requireNonNull(launcher, "launcher");
        Objects.requireNonNull(identifiers, "identifiers");
        return new GameLauncherBinding(Arrays.asList(identifiers), launcher);
    }

    public List<String> identifiers() {
        return identifiers;
    }

    public GameLauncher launcher() {
        return launcher;
    }
}
