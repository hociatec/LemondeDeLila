package com.lemondelila.client.media;

import com.lemondelila.client.model.settings.AppSettings;
import com.lemondelila.client.service.settings.AppSettingsService;
import com.lemondelila.framework.media.audio.AudioService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URL;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;

public final class SoundEffectManager {

    private static final Logger LOGGER = LoggerFactory.getLogger(SoundEffectManager.class);

    private final AudioService audioService;
    private final AppSettingsService settingsService;
    private final AtomicBoolean preloaded = new AtomicBoolean();
    private final Map<String, Float> appliedGains = new ConcurrentHashMap<>();
    private volatile float sfxGainDb;
    @SuppressWarnings("unused")
    private final AutoCloseable settingsSubscription;

    public SoundEffectManager(AudioService audioService,
                              AppSettingsService settingsService) {
        this.audioService = Objects.requireNonNull(audioService, "audioService");
        this.settingsService = Objects.requireNonNull(settingsService, "settingsService");
        applyVolume(settingsService.current());
        this.settingsSubscription = settingsService.listen(this::applyVolume);
    }

    public void preloadDefaults() {
        if (!preloaded.compareAndSet(false, true)) {
            return;
        }
        for (SoundEffect effect : SoundEffect.values()) {
            try {
                URL resource = locate(effect);
                audioService.preload(effect.key(), resource);
                audioService.setVolume(effect.key(), sfxGainDb);
                appliedGains.put(effect.key(), sfxGainDb);
            } catch (Exception ex) {
                LOGGER.warn("Impossible de charger le son {} ({})", effect, effect.resourcePath(), ex);
            }
        }
    }

    public void play(SoundEffect effect) {
        Objects.requireNonNull(effect, "effect");
        if (!preloaded.get()) {
            preloadDefaults();
        }
        Float current = appliedGains.get(effect.key());
        if (current == null || Math.abs(current - sfxGainDb) > 0.5f) {
            audioService.setVolume(effect.key(), sfxGainDb);
            appliedGains.put(effect.key(), sfxGainDb);
        }
        audioService.play(effect.key());
    }

    private URL locate(SoundEffect effect) {
        URL resource = SoundEffectManager.class.getResource(effect.resourcePath());
        if (resource == null) {
            throw new IllegalStateException("Ressource audio introuvable: " + effect.resourcePath());
        }
        return resource;
    }

    private void applyVolume(AppSettings settings) {
        int volume = settings.gameVolume();
        if (volume <= 0) {
            sfxGainDb = -80f;
        } else {
            float linear = volume / 100f;
            sfxGainDb = Math.max(-80f, Math.min(0f, (float) (Math.log10(linear) * 20.0)));
        }
        if (preloaded.get()) {
            for (SoundEffect effect : SoundEffect.values()) {
                audioService.setVolume(effect.key(), sfxGainDb);
                appliedGains.put(effect.key(), sfxGainDb);
            }
        } else {
            appliedGains.clear();
        }
    }
}
