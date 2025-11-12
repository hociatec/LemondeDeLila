package com.lemondelila.client.service.settings;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.lemondelila.client.model.settings.AppSettings;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.locks.ReentrantReadWriteLock;

public final class AppSettingsService {

    private static final Path SETTINGS_PATH = Path.of("config", "settings.json");
    private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private final CopyOnWriteArrayList<java.util.function.Consumer<AppSettings>> listeners = new CopyOnWriteArrayList<>();
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
        AppSettings sanitized = sanitize(newSettings);
        lock.writeLock().lock();
        try {
            this.settings = sanitized;
            save();
        } finally {
            lock.writeLock().unlock();
        }
        notifyListeners(sanitized);
    }

    public AutoCloseable listen(java.util.function.Consumer<AppSettings> listener) {
        Objects.requireNonNull(listener, "listener");
        listeners.add(listener);
        return () -> listeners.remove(listener);
    }

    private void load() {
        if (!Files.exists(SETTINGS_PATH)) {
            return;
        }
        lock.writeLock().lock();
        try {
            JsonNode node = mapper.readTree(SETTINGS_PATH.toFile());
            AppSettings defaults = AppSettings.defaults();
            int fallbackEffectsVolume = readVolume(node, "gameVolume", defaults.soundAppLaunchVolume());
            AppSettings loaded = new AppSettings(
                    readVolume(node, "musicVolume", defaults.musicVolume()),
                    readFlag(node, "soundEnabled", defaults.soundEnabled()),
                    readFlag(node, "soundAppLaunch", defaults.soundAppLaunch()),
                    readVolume(node, "soundAppLaunchVolume", fallbackEffectsVolume),
                    readFlag(node, "soundBackground", defaults.soundBackground()),
                    readVolume(node, "soundBackgroundVolume", fallbackEffectsVolume),
                    readFlag(node, "soundNavigate", defaults.soundNavigate()),
                    readVolume(node, "soundNavigateVolume", fallbackEffectsVolume),
                    readFlag(node, "soundSelect", defaults.soundSelect()),
                    readVolume(node, "soundSelectVolume", fallbackEffectsVolume),
                    readFlag(node, "confirmOnExit", defaults.confirmOnExit()),
                    readFlag(node, "chatEnabled", defaults.chatEnabled()),
                    readFlag(node, "confirmChatExit", defaults.confirmChatExit())
            );
            settings = sanitize(loaded);
        } catch (IOException ignored) {
            settings = AppSettings.defaults();
        } finally {
            lock.writeLock().unlock();
        }
        notifyListeners(settings);
    }

    private void save() {
        try {
            Files.createDirectories(SETTINGS_PATH.getParent());
            mapper.writeValue(SETTINGS_PATH.toFile(), settings);
        } catch (IOException ignored) {
        }
    }

    private void notifyListeners(AppSettings currentSettings) {
        listeners.forEach(listener -> {
            try {
                listener.accept(currentSettings);
            } catch (Exception ignored) {
            }
        });
    }

    private boolean readFlag(JsonNode node, String field, boolean fallback) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return fallback;
        }
        return value.asBoolean(fallback);
    }

    private int readVolume(JsonNode node, String field, int fallback) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return clampVolume(fallback);
        }
        return clampVolume(value.asInt(fallback));
    }

    private AppSettings sanitize(AppSettings candidate) {
        if (candidate == null) {
            return AppSettings.defaults();
        }
        return new AppSettings(
                clampVolume(candidate.musicVolume()),
                candidate.soundEnabled(),
                candidate.soundAppLaunch(),
                clampVolume(candidate.soundAppLaunchVolume()),
                candidate.soundBackground(),
                clampVolume(candidate.soundBackgroundVolume()),
                candidate.soundNavigate(),
                clampVolume(candidate.soundNavigateVolume()),
                candidate.soundSelect(),
                clampVolume(candidate.soundSelectVolume()),
                candidate.confirmOnExit(),
                candidate.chatEnabled(),
                candidate.confirmChatExit()
        );
    }

    private int clampVolume(int value) {
        return Math.max(0, Math.min(100, value));
    }
}

