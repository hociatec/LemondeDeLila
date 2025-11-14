package com.lemondelila.client.settings.controller;

import com.lemondelila.client.media.SoundBank;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.settings.update.UpdateService;
import com.lemondelila.client.settings.view.OptionsDialog;
import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;

import java.awt.Window;
import java.util.Objects;

/**
 * Launches the options dialog.
 */
public final class OptionsController {

    private final AppSettingsService settingsService;
    private final UpdateService updateService;
    private final SoundEffectManager sounds;

    @Inject
    public OptionsController(AppSettingsService settingsService,
                             UpdateService updateService,
                             SoundEffectManager sounds) {
        this.settingsService = Objects.requireNonNull(settingsService, "settingsService");
        this.updateService = Objects.requireNonNull(updateService, "updateService");
        this.sounds = sounds;
    }

    /**
     * Opens the options dialog.
     *
     * @param owner parent window (nullable).
     * @return status message for the view.
     */
    public String open(Window owner) {
        if (sounds != null) {
            sounds.play(SoundBank.MENU_SELECT);
        }
        OptionsDialog dialog = new OptionsDialog(owner, settingsService, updateService, sounds);
        dialog.setVisible(true);
        return "Options mises a jour.";
    }
}
