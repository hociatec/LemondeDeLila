package com.lemondelila.client.application;

import com.lemondelila.client.framework.core.config.ConfigurationService;
import com.lemondelila.client.framework.core.di.Inject;

public final class AppBranding {

    private final String applicationName;

    @Inject
    public AppBranding(ConfigurationService configurationService) {
        this.applicationName = configurationService.get("app.name", "Les mondes de Lilas");
    }

    public String applicationName() {
        return applicationName;
    }
}
