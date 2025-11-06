package com.lemondelila.client.settings;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.concurrent.locks.ReentrantReadWriteLock;

public final class AppSettingsService {

    private static final Path SETTINGS_PATH = Path.of("config", "settings.json");
    private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private AppSettings settings;

    public AppSettingsService() {
        this.settings = AppSettings.defaults();
        load();
    }

    public AppSettings current() {
        lock.readLock().lock();
        try {
            return settings;
        } finally {
            lock.readLock().unlock();
        }
    }

    public void update(AppSettings newSettings) {
        Objects.requireNonNull(newSettings, "newSettings");
        lock.writeLock().lock();
        try {
            this.settings = newSettings;
            save();
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void load() {
        if (!Files.exists(SETTINGS_PATH)) {
            return;
        }
        lock.writeLock().lock();
        try {
            JsonNode node = mapper.readTree(SETTINGS_PATH.toFile());
            AppSettings loaded = mapper.treeToValue(node, AppSettings.class);
            boolean chatEnabled = node.path("chatEnabled").isMissingNode() ? true : loaded.chatEnabled();
            boolean confirmChatExit = node.path("confirmChatExit").isMissingNode() ? false : loaded.confirmChatExit();
            settings = new AppSettings(
                    loaded.gameVolume(),
                    loaded.musicVolume(),
                    loaded.confirmOnExit(),
                    chatEnabled,
                    confirmChatExit
            );
        } catch (IOException ignored) {
            settings = AppSettings.defaults();
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void save() {
        try {
            Files.createDirectories(SETTINGS_PATH.getParent());
            mapper.writeValue(SETTINGS_PATH.toFile(), settings);
        } catch (IOException ignored) {
        }
    }
}

