package com.lemondelila.client.network;

import com.lemondelila.client.framework.core.config.ConfigurationService;

import java.util.Objects;

/**
 * Fournit le jeton CSRF côté client s’il est déclaré dans la configuration.
 */
public final class CsrfTokenProvider {

    private static final String DEFAULT_KEY = "network.csrf.token";
    private final String token;

    public CsrfTokenProvider(ConfigurationService configurationService) {
        this.token = configurationService.get(DEFAULT_KEY, "").trim();
    }

    public String current() {
        return token;
    }

    public boolean isPresent() {
        return token != null && !token.isBlank();
    }
}
