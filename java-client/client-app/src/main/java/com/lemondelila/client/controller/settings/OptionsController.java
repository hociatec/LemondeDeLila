package com.lemondelila.client.controller.settings;

import com.lemondelila.client.service.settings.AppSettingsService;
import com.lemondelila.client.view.options.OptionsDialog;

import java.awt.Window;
import java.util.Objects;

/**
 * Launches the options dialog.
 */
public final class OptionsController {

    private final AppSettingsService settingsService;

    public OptionsController(AppSettingsService settingsService) {
        this.settingsService = Objects.requireNonNull(settingsService, "settingsService");
    }

    /**
     * Opens the options dialog.
     *
     * @param owner parent window (nullable).
     * @return status message for the view.
     */
    public String open(Window owner) {
        OptionsDialog dialog = new OptionsDialog(owner, settingsService);
        dialog.setVisible(true);
        return "Options mises a jour.";
    }
}
