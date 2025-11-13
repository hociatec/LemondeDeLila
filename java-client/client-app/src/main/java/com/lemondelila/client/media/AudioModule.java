package com.lemondelila.client.media;

import com.lemondelila.client.media.SoundBank;
import com.lemondelila.client.settings.model.AppSettings;
import com.lemondelila.client.settings.service.AppSettingsService;
import com.lemondelila.client.framework.core.context.ApplicationContext;
import com.lemondelila.client.framework.core.module.LilaModule;
import com.lemondelila.client.framework.media.audio.AudioService;
import com.lemondelila.client.framework.media.sound.SoundEffectManager;
import com.lemondelila.client.framework.media.sound.SoundPreferences;

import java.util.List;

public final class AudioModule implements LilaModule {

    @Override
    public void configure(ApplicationContext.Builder builder) {
        builder.bindFactory(SoundEffectManager.class, ctx -> {
            SoundEffectManager manager = new SoundEffectManager(ctx.get(AudioService.class));
            manager.registerClips(List.of(SoundBank.values()));
            AppSettingsService settings = ctx.get(AppSettingsService.class);
            manager.applyPreferences(new SettingsSoundPreferences(settings.current()));
            settings.listen(prefs -> manager.applyPreferences(new SettingsSoundPreferences(prefs)));
            return manager;
        });
    }

    @Override
    public void stop(ApplicationContext context) {
        context.find(SoundEffectManager.class).ifPresent(SoundEffectManager::stopAllLooping);
    }

    @Override
    public int order() {
        return 70;
    }

    private record SettingsSoundPreferences(AppSettings settings) implements SoundPreferences {
        @Override
        public boolean isEnabled(String clipKey) {
            if (!settings.soundEnabled()) {
                return false;
            }
            return switch (clipKey) {
                case "sound.app.launch" -> settings.soundAppLaunch() && settings.soundAppLaunchVolume() > 0;
                case "sound.background.fon" -> settings.soundBackground() && settings.soundBackgroundVolume() > 0;
                case "sound.menu.navigate" -> settings.soundNavigate() && settings.soundNavigateVolume() > 0;
                case "sound.menu.select" -> settings.soundSelect() && settings.soundSelectVolume() > 0;
                default -> true;
            };
        }

        @Override
        public int volumeFor(String clipKey) {
            if (!settings.soundEnabled()) {
                return 0;
            }
            return switch (clipKey) {
                case "sound.app.launch" -> resolve(settings.soundAppLaunch(), settings.soundAppLaunchVolume());
                case "sound.background.fon" -> resolve(settings.soundBackground(), settings.soundBackgroundVolume());
                case "sound.menu.navigate" -> resolve(settings.soundNavigate(), settings.soundNavigateVolume());
                case "sound.menu.select" -> resolve(settings.soundSelect(), settings.soundSelectVolume());
                default -> 100;
            };
        }

        private int resolve(boolean enabled, int volume) {
            if (!enabled) {
                return 0;
            }
            return Math.max(0, Math.min(100, volume));
        }
    }
}
