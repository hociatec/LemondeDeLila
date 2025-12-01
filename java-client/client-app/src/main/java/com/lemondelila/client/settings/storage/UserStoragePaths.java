package com.lemondelila.client.settings.storage;

import com.lemondelila.client.framework.core.config.ConfigurationService;
import com.lemondelila.client.framework.core.di.Inject;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Résout le répertoire de stockage utilisateur (config/session) de manière portable.
 */
public final class UserStoragePaths {

    private static final String DEFAULT_DIR_NAME = "LilaClient";

    private final Path baseDirectory;

    @Inject
    public UserStoragePaths(ConfigurationService configurationService) {
        String override = configurationService.get("app.storage.dir", "").trim();
        if (!override.isEmpty()) {
            this.baseDirectory = Paths.get(override);
        } else {
            this.baseDirectory = resolveDefaultBase();
        }
    }

    public Path settingsFile() {
        return baseDirectory.resolve("settings.json");
    }

    public Path sessionFile() {
        return baseDirectory.resolve("session.json");
    }

    private static Path resolveDefaultBase() {
        String os = System.getProperty("os.name", "").toLowerCase();
        String userHome = System.getProperty("user.home", ".");
        if (os.contains("win")) {
            String appData = System.getenv("APPDATA");
            if (appData != null && !appData.isBlank()) {
                return Paths.get(appData, DEFAULT_DIR_NAME);
            }
            return Paths.get(userHome, DEFAULT_DIR_NAME);
        }
        if (os.contains("mac")) {
            return Paths.get(userHome, "Library", "Application Support", DEFAULT_DIR_NAME);
        }
        return Paths.get(userHome, "." + DEFAULT_DIR_NAME.toLowerCase());
    }
}
