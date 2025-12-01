package com.lemondelila.client.settings.view;

import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.settings.update.UpdateService;

import javax.inject.Inject;
import java.awt.Window;
import java.util.Objects;

public final class DefaultOptionsDialogFactory implements OptionsDialogFactory {

    private final AppSettingsService settingsService;
    private final UpdateService updateService;
    private final SoundEffectManager sounds;

    @Inject
    public DefaultOptionsDialogFactory(AppSettingsService settingsService,
                                       UpdateService updateService,
                                       SoundEffectManager sounds) {
        this.settingsService = Objects.requireNonNull(settingsService, "settingsService");
        this.updateService = Objects.requireNonNull(updateService, "updateService");
        this.sounds = sounds;
    }

    @Override
    public OptionsDialog create(Window owner) {
        return new OptionsDialog(owner, settingsService, updateService, sounds);
    }
}
