package com.lemondelila.client.application;

import com.lemondelila.client.framework.core.config.ConfigurationService;
import com.lemondelila.client.framework.core.di.Inject;

import com.lemondelila.client.framework.core.branding.AppBrandingProvider;

public final class AppBranding implements AppBrandingProvider {

    private final String applicationName;

    @Inject
    public AppBranding(ConfigurationService configurationService) {
        this.applicationName = configurationService.get("app.name", "Les mondes de Lilas");
    }

    public String applicationName() {
        return applicationName;
    }
}
