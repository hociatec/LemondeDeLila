package com.lemondelila.client.settings.controller;

import com.lemondelila.client.framework.core.di.Inject;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.ui.ControllerResult;
import com.lemondelila.client.media.SoundBank;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.settings.update.UpdateService;
import com.lemondelila.client.settings.view.OptionsDialog;
import com.lemondelila.client.settings.view.OptionsDialogFactory;

import java.awt.Window;
import java.util.Objects;

/**
 * Launches the options dialog.
 */
public final class OptionsController {

    private final AppSettingsService settingsService;
    private final UpdateService updateService;
    private final SoundEffectManager sounds;
    private final OptionsDialogFactory dialogFactory;

    @Inject
    public OptionsController(AppSettingsService settingsService,
                             UpdateService updateService,
                             SoundEffectManager sounds,
                             OptionsDialogFactory dialogFactory) {
        this.settingsService = Objects.requireNonNull(settingsService, "settingsService");
        this.updateService = Objects.requireNonNull(updateService, "updateService");
        this.sounds = sounds;
        this.dialogFactory = Objects.requireNonNull(dialogFactory, "dialogFactory");
    }

    /**
     * Opens the options dialog.
     *
     * @param owner parent window (nullable).
     * @return résultat applicatif (message éventuel).
     */
    public ControllerResult open(Window owner) {
        if (sounds != null) {
            sounds.play(SoundBank.MENU_SELECT);
        }
        OptionsDialog dialog = dialogFactory.create(owner);
        dialog.setVisible(true);
        return ControllerResult.status("Options mises a jour.");
    }
}
