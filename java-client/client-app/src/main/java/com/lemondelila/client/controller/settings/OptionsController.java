package com.lemondelila.client.controller.settings;

import com.lemondelila.client.media.SoundBank;
import com.lemondelila.client.service.settings.AppSettingsService;
import com.lemondelila.client.view.options.OptionsDialog;
import com.lemondelila.framework.core.di.Inject;
import com.lemondelila.framework.media.sound.SoundEffectManager;

import java.awt.Window;
import java.util.Objects;

/**
 * Launches the options dialog.
 */
public final class OptionsController {

    private final AppSettingsService settingsService;
    private final SoundEffectManager sounds;

    @Inject
    public OptionsController(AppSettingsService settingsService, SoundEffectManager sounds) {
        this.settingsService = Objects.requireNonNull(settingsService, "settingsService");
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
        OptionsDialog dialog = new OptionsDialog(owner, settingsService, sounds);
        dialog.setVisible(true);
        return "Options mises a jour.";
    }
}
