package com.lemondelila.framework.core.config;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Objects;
import java.util.Optional;
import java.util.Properties;

/**
 * Chargement simple d'une configuration externe.
 */
public final class ConfigurationService {

    private final Properties properties = new Properties();

    public ConfigurationService() {
        loadClasspath("config/client.properties");
        loadFileSystem(Path.of("config", "client.properties"));
    }

    public String get(String key, String defaultValue) {
        Objects.requireNonNull(key, "key");
        return properties.getProperty(key, defaultValue);
    }

    public Optional<String> get(String key) {
        Objects.requireNonNull(key, "key");
        return Optional.ofNullable(properties.getProperty(key));
    }

    public int getInt(String key, int defaultValue) {
        String value = properties.getProperty(key);
        if (value == null) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException ex) {
            return defaultValue;
        }
    }

    private void loadClasspath(String resource) {
        try (InputStream in = Thread.currentThread().getContextClassLoader().getResourceAsStream(resource)) {
            if (in != null) {
                properties.load(in);
            }
        } catch (IOException ignored) {
        }
    }

    private void loadFileSystem(Path path) {
        if (!Files.exists(path)) {
            return;
        }
        try (InputStream in = Files.newInputStream(path)) {
            properties.load(in);
        } catch (IOException ignored) {
        }
    }
}

