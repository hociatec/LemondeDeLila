package com.lemondelila.client.settings.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.lemondelila.client.settings.model.AppSettings;
import com.lemondelila.client.settings.storage.UserStoragePaths;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.locks.ReentrantReadWriteLock;

public final class AppSettingsService {

    private static final Logger LOGGER = LoggerFactory.getLogger(AppSettingsService.class);
    private final Path settingsPath;
    private final ObjectMapper mapper = new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private final CopyOnWriteArrayList<java.util.function.Consumer<AppSettings>> listeners = new CopyOnWriteArrayList<>();
    private AppSettings settings;

    public AppSettingsService(UserStoragePaths storagePaths) {
        this.settingsPath = storagePaths.settingsFile();
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
        if (!Files.exists(settingsPath)) {
            return;
        }
        lock.writeLock().lock();
        try {
            JsonNode node = mapper.readTree(settingsPath.toFile());
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
                    readFlag(node, "confirmChatExit", defaults.confirmChatExit()),
                    readFlag(node, "stayConnected", defaults.stayConnected()),
                    readFlag(node, "extraDescriptionsEnabled", defaults.extraDescriptionsEnabled())
            );
            settings = sanitize(loaded);
        } catch (IOException ex) {
            LOGGER.warn("Impossible de charger les paramètres dans {}", settingsPath, ex);
            settings = AppSettings.defaults();
        } finally {
            lock.writeLock().unlock();
        }
        notifyListeners(settings);
    }

    private void save() {
        try {
            Files.createDirectories(settingsPath.getParent());
            mapper.writeValue(settingsPath.toFile(), settings);
        } catch (IOException ex) {
            LOGGER.warn("Impossible d'enregistrer les paramètres dans {}", settingsPath, ex);
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
                candidate.confirmChatExit(),
                candidate.stayConnected(),
                candidate.extraDescriptionsEnabled()
        );
    }

    private int clampVolume(int value) {
        return Math.max(0, Math.min(100, value));
    }
}

