package com.lemondelila.client.config;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.Objects;
import java.util.Properties;

/**
 * Gestion centralisee de la configuration du client.
 * Permet d'extraire l'URL du backend ainsi que les options eventuelles.
 */
public final class ClientConfig {

    private static final String DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api/";
    private static final String PROPERTIES_FILE = "/client.properties";
    private static final String PROPERTY_API_BASE_URL = "api.baseUrl";
    private static final String ENV_API_BASE_URL = "LILA_API_BASE_URL";

    private final URI apiBaseUri;

    private ClientConfig(URI apiBaseUri) {
        this.apiBaseUri = apiBaseUri;
    }

    public static ClientConfig load() {
        String baseUrl = readBaseUrlFromProperties();
        String envOverride = System.getenv(ENV_API_BASE_URL);
        if (envOverride != null && !envOverride.isBlank()) {
            baseUrl = envOverride.trim();
        }
        if (baseUrl == null || baseUrl.isBlank()) {
            baseUrl = DEFAULT_API_BASE_URL;
        }
        return new ClientConfig(normalizeBaseUri(baseUrl));
    }

    public URI apiBaseUri() {
        return apiBaseUri;
    }

    public URI loginUri() {
        return apiBaseUri.resolve("login");
    }

    public URI registerUri() {
        return apiBaseUri.resolve("register");
    }

    public URI catalogCategoriesUri() {
        return apiBaseUri.resolve("catalog/categories");
    }

    public URI roomsUri() {
        return apiBaseUri.resolve("rooms/");
    }

    private static String readBaseUrlFromProperties() {
        Properties properties = new Properties();
        try (InputStream input = ClientConfig.class.getResourceAsStream(PROPERTIES_FILE)) {
            if (input != null) {
                properties.load(input);
            }
        } catch (IOException e) {
            // Ignore : on retombera sur la valeur par defaut
            return DEFAULT_API_BASE_URL;
        }
        return properties.getProperty(PROPERTY_API_BASE_URL, DEFAULT_API_BASE_URL).trim();
    }

    private static URI normalizeBaseUri(String baseUrl) {
        Objects.requireNonNull(baseUrl, "baseUrl");
        String trimmed = baseUrl.trim();
        if (!trimmed.endsWith("/")) {
            trimmed = trimmed + "/";
        }
        return URI.create(trimmed);
    }
}
